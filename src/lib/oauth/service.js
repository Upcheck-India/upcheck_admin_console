// src/lib/oauth/service.js
//
// The OAuth 2.0 authorization-server engine for "Upcheck ERP Data OAuth".
// Implements the Authorization Code + PKCE flow (the only interactive grant in
// Phase 1) plus refresh-token rotation, revocation (RFC 7009), introspection
// (RFC 7662) and bearer-token resolution for the resource server.
//
// Token design: access & refresh tokens are opaque, high-entropy randoms. Only
// their HMAC/SHA-256 fingerprint is stored, so revocation is instant (flip a
// flag / delete the row) and a DB dump exposes no usable credential. Short
// access TTL (1h) + rotating refresh tokens (30d) with REUSE DETECTION: if a
// refresh token that was already rotated is presented again, the whole grant is
// revoked (classic stolen-token containment).
import crypto from 'node:crypto';
import {
  OAuthError,
  OAUTH_ERROR,
  invalidClient,
  invalidGrant,
  invalidRequest,
} from './errors';
import {
  randomToken,
  fingerprint,
  fingerprintsEqual,
  verifyPkceS256,
  isValidCodeVerifier,
} from './crypto';
import { CLIENT_STATUS, redirectUriRegistered, clientIsUsable } from './clients';
import { grantableScopes, scopeToWire } from './scopes';

export const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const CODE_TTL_SECONDS = 300; // 5 minutes
export const AUTH_REQUEST_TTL_SECONDS = 600; // 10 minutes

const COL = {
  clients: 'oauth_clients',
  authRequests: 'oauth_auth_requests',
  codes: 'oauth_authorization_codes',
  access: 'oauth_access_tokens',
  refresh: 'oauth_refresh_tokens',
  grants: 'oauth_grants',
};

function secondsFromNow(s) {
  return new Date(Date.now() + s * 1000);
}
function randomId(prefix) {
  return `${prefix}_${randomToken(12)}`;
}

// ---------------------------------------------------------------------------
// Client lookup & authentication
// ---------------------------------------------------------------------------

export async function findClient(db, clientId) {
  if (typeof clientId !== 'string' || !clientId) return null;
  return db.collection(COL.clients).findOne({ clientId });
}

/**
 * Authenticate a confidential client by clientId + secret. Constant-time secret
 * comparison via stored fingerprint. Throws invalid_client on any mismatch.
 * `requireActive` gates token issuance to verified/enabled clients only.
 */
export async function authenticateClient(db, { clientId, clientSecret }, { requireActive = true } = {}) {
  const client = await findClient(db, clientId);
  // Uniform failure so we don't reveal whether the id or the secret was wrong.
  if (!client || !clientSecret) throw invalidClient('Client authentication failed');
  const ok = fingerprintsEqual(client.clientSecretHash, fingerprint(clientSecret));
  if (!ok) throw invalidClient('Client authentication failed');
  if (client.status === CLIENT_STATUS.REVOKED) {
    throw invalidClient('Client has been revoked');
  }
  if (requireActive && !clientIsUsable(client)) {
    throw new OAuthError(
      OAUTH_ERROR.UNAUTHORIZED_CLIENT,
      client.status === CLIENT_STATUS.PENDING
        ? 'Client is pending verification'
        : 'Client is not active'
    );
  }
  return client;
}

/**
 * Extract client credentials from either HTTP Basic auth (preferred) or the
 * request body (client_secret_post). Returns { clientId, clientSecret }.
 */
export function extractClientCredentials(request, body) {
  const header = request.headers.get('authorization') || '';
  if (/^Basic\s+/i.test(header)) {
    try {
      const decoded = Buffer.from(header.replace(/^Basic\s+/i, ''), 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      if (idx >= 0) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, idx)),
          clientSecret: decodeURIComponent(decoded.slice(idx + 1)),
        };
      }
    } catch {
      /* fall through to body */
    }
  }
  return {
    clientId: typeof body?.client_id === 'string' ? body.client_id : '',
    clientSecret: typeof body?.client_secret === 'string' ? body.client_secret : '',
  };
}

// ---------------------------------------------------------------------------
// Authorization request (consent) lifecycle
// ---------------------------------------------------------------------------

/**
 * Persist a validated authorization request pending admin consent. Returns the
 * opaque requestId used to drive the consent screen. Nothing here is a
 * credential; the request is single-use and short-lived.
 */
export async function createAuthRequest(db, params) {
  const requestId = randomId('req');
  const now = new Date();
  await db.collection(COL.authRequests).insertOne({
    requestId,
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    scopes: params.scopes,
    state: params.state || null,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: 'S256',
    status: 'pending',
    createdAt: now,
    expiresAt: secondsFromNow(AUTH_REQUEST_TTL_SECONDS),
  });
  return requestId;
}

export async function getAuthRequest(db, requestId) {
  if (typeof requestId !== 'string' || !requestId) return null;
  const doc = await db.collection(COL.authRequests).findOne({ requestId });
  if (!doc) return null;
  if (doc.status !== 'pending') return { ...doc, expired: false, consumed: true };
  const expired = doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now();
  return { ...doc, expired: !!expired, consumed: false };
}

/**
 * Admin approves the request → mint a single-use authorization code bound to the
 * client, redirect_uri, scopes and PKCE challenge, plus the approving admin.
 * Returns { code, redirectUri, state }.
 */
export async function approveAuthRequest(db, requestId, { actor }) {
  // Driver v6: findOneAndUpdate returns the document directly (null if no match).
  const req = await db.collection(COL.authRequests).findOneAndUpdate(
    { requestId, status: 'pending', expiresAt: { $gt: new Date() } },
    { $set: { status: 'approved', approvedBy: actor || null, decidedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!req) throw invalidRequest('Authorization request not found, already decided, or expired');

  const code = randomToken(32);
  await db.collection(COL.codes).insertOne({
    codeHash: fingerprint(code),
    clientId: req.clientId,
    redirectUri: req.redirectUri,
    scopes: req.scopes,
    codeChallenge: req.codeChallenge,
    codeChallengeMethod: 'S256',
    approvedBy: actor || null,
    usedAt: null,
    createdAt: new Date(),
    expiresAt: secondsFromNow(CODE_TTL_SECONDS),
  });
  return { code, redirectUri: req.redirectUri, state: req.state || null };
}

/** Admin denies the request. Returns redirect target so the caller can bounce back. */
export async function denyAuthRequest(db, requestId, { actor }) {
  const req = await db.collection(COL.authRequests).findOneAndUpdate(
    { requestId, status: 'pending' },
    { $set: { status: 'denied', deniedBy: actor || null, decidedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!req) throw invalidRequest('Authorization request not found or already decided');
  return { redirectUri: req.redirectUri, state: req.state || null };
}

// ---------------------------------------------------------------------------
// Grants & token minting
// ---------------------------------------------------------------------------

/** One active grant per client (the org is the resource owner). Upserted. */
async function upsertGrant(db, { clientId, scopes, actor }) {
  const now = new Date();
  // clientId + status come from the filter equality on insert; putting them in
  // $setOnInsert too would be a path conflict. Only insert-only fields here.
  return db.collection(COL.grants).findOneAndUpdate(
    { clientId, status: 'active' },
    {
      $set: { scopes, approvedBy: actor || null, updatedAt: now, lastUsedAt: now },
      $setOnInsert: { grantId: randomId('grant'), createdAt: now },
    },
    { upsert: true, returnDocument: 'after' }
  );
}

async function mintAccessToken(db, { clientId, grantId, scopes }) {
  const token = randomToken(32);
  await db.collection(COL.access).insertOne({
    tokenHash: fingerprint(token),
    clientId,
    grantId,
    scopes,
    createdAt: new Date(),
    expiresAt: secondsFromNow(ACCESS_TTL_SECONDS),
    revokedAt: null,
    lastUsedAt: null,
  });
  return token;
}

async function mintRefreshToken(db, { clientId, grantId, scopes }) {
  const token = randomToken(32);
  await db.collection(COL.refresh).insertOne({
    tokenHash: fingerprint(token),
    clientId,
    grantId,
    scopes,
    createdAt: new Date(),
    expiresAt: secondsFromNow(REFRESH_TTL_SECONDS),
    rotatedAt: null,
    revokedAt: null,
  });
  return token;
}

function tokenResponse({ accessToken, refreshToken, scopes }) {
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: scopeToWire(scopes),
  };
}

/** Revoke every access & refresh token belonging to a grant (containment). */
async function revokeGrantTokens(db, grantId) {
  if (!grantId) return;
  const now = new Date();
  await Promise.all([
    db.collection(COL.access).updateMany({ grantId, revokedAt: null }, { $set: { revokedAt: now } }),
    db.collection(COL.refresh).updateMany({ grantId, revokedAt: null }, { $set: { revokedAt: now } }),
  ]);
}

// ---------------------------------------------------------------------------
// grant_type=authorization_code
// ---------------------------------------------------------------------------

export async function exchangeAuthorizationCode(db, { client, code, redirectUri, codeVerifier }) {
  if (typeof code !== 'string' || !code) throw invalidGrant('Missing authorization code');
  if (!isValidCodeVerifier(codeVerifier)) throw invalidRequest('Missing or malformed code_verifier');

  const codeDoc = await db.collection(COL.codes).findOne({ codeHash: fingerprint(code) });
  if (!codeDoc) throw invalidGrant('Authorization code is invalid or expired');

  // Replay: a previously-used code is a strong signal of interception. Contain
  // the blast radius by revoking all tokens on the client's grant, then reject.
  if (codeDoc.usedAt) {
    const grant = await db.collection(COL.grants).findOne({ clientId: codeDoc.clientId, status: 'active' });
    if (grant) await revokeGrantTokens(db, grant.grantId);
    throw invalidGrant('Authorization code has already been used');
  }
  if (codeDoc.clientId !== client.clientId) throw invalidGrant('Authorization code was issued to another client');
  if (codeDoc.redirectUri !== redirectUri) throw invalidGrant('redirect_uri does not match the authorization request');
  if (codeDoc.expiresAt && new Date(codeDoc.expiresAt).getTime() <= Date.now()) {
    throw invalidGrant('Authorization code has expired');
  }
  if (!verifyPkceS256(codeVerifier, codeDoc.codeChallenge)) {
    throw invalidGrant('PKCE verification failed');
  }

  // Atomically claim the code (guards the race between the checks above). Default
  // returnDocument is 'before' → a non-null result means we won the claim.
  const claim = await db.collection(COL.codes).findOneAndUpdate(
    { _id: codeDoc._id, usedAt: null },
    { $set: { usedAt: new Date() } }
  );
  if (!claim) throw invalidGrant('Authorization code has already been used');

  const scopes = Array.isArray(codeDoc.scopes) ? codeDoc.scopes : [];
  const grant = await upsertGrant(db, { clientId: client.clientId, scopes, actor: codeDoc.approvedBy });
  const accessToken = await mintAccessToken(db, { clientId: client.clientId, grantId: grant.grantId, scopes });
  const refreshToken = await mintRefreshToken(db, { clientId: client.clientId, grantId: grant.grantId, scopes });

  // Record which grant this code produced, for precise replay containment.
  await db.collection(COL.codes).updateOne({ _id: codeDoc._id }, { $set: { grantId: grant.grantId } });

  return { response: tokenResponse({ accessToken, refreshToken, scopes }), grant, scopes };
}

// ---------------------------------------------------------------------------
// grant_type=refresh_token (rotation + reuse detection)
// ---------------------------------------------------------------------------

export async function refreshAccessToken(db, { client, refreshToken, requestedScope }) {
  if (typeof refreshToken !== 'string' || !refreshToken) throw invalidGrant('Missing refresh_token');
  const doc = await db.collection(COL.refresh).findOne({ tokenHash: fingerprint(refreshToken) });
  if (!doc) throw invalidGrant('Refresh token is invalid');
  if (doc.clientId !== client.clientId) throw invalidGrant('Refresh token was issued to another client');

  // Reuse detection: a rotated (already-consumed) or revoked refresh token being
  // presented means it may have leaked → revoke the entire grant chain.
  if (doc.rotatedAt || doc.revokedAt) {
    await revokeGrantTokens(db, doc.grantId);
    throw invalidGrant('Refresh token has been revoked (possible reuse detected)');
  }
  if (doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now()) {
    throw invalidGrant('Refresh token has expired');
  }
  const grant = await db.collection(COL.grants).findOne({ grantId: doc.grantId });
  if (!grant || grant.status !== 'active') throw invalidGrant('The underlying grant has been revoked');

  // Optional scope narrowing — a refresh may never widen scope.
  let scopes = Array.isArray(doc.scopes) ? doc.scopes : [];
  if (requestedScope) {
    const narrowed = grantableScopes(requestedScope.split(/\s+/), scopes);
    if (!narrowed.length) throw new OAuthError(OAUTH_ERROR.INVALID_SCOPE, 'Requested scope exceeds the grant');
    scopes = narrowed;
  }

  // Atomically consume this refresh token (rotate). If the CAS fails, another
  // request already rotated it → treat as reuse.
  const claim = await db.collection(COL.refresh).findOneAndUpdate(
    { _id: doc._id, rotatedAt: null, revokedAt: null },
    { $set: { rotatedAt: new Date() } }
  );
  if (!claim) {
    await revokeGrantTokens(db, doc.grantId);
    throw invalidGrant('Refresh token has already been used');
  }

  const accessToken = await mintAccessToken(db, { clientId: client.clientId, grantId: doc.grantId, scopes });
  const newRefresh = await mintRefreshToken(db, { clientId: client.clientId, grantId: doc.grantId, scopes });
  await db.collection(COL.grants).updateOne({ grantId: doc.grantId }, { $set: { lastUsedAt: new Date() } });

  return { response: tokenResponse({ accessToken, refreshToken: newRefresh, scopes }), scopes };
}

// ---------------------------------------------------------------------------
// Revocation (RFC 7009) & introspection (RFC 7662)
// ---------------------------------------------------------------------------

/**
 * Revoke an access or refresh token owned by the authenticated client. Per RFC
 * 7009 the endpoint returns success regardless of whether the token existed, to
 * avoid leaking token validity. Revoking a refresh token also revokes access
 * tokens minted under the same grant.
 */
export async function revokeToken(db, { client, token }) {
  if (typeof token !== 'string' || !token) return;
  const hash = fingerprint(token);
  const now = new Date();

  const access = await db.collection(COL.access).findOne({ tokenHash: hash });
  if (access && access.clientId === client.clientId) {
    await db.collection(COL.access).updateOne({ _id: access._id, revokedAt: null }, { $set: { revokedAt: now } });
    return;
  }
  const refresh = await db.collection(COL.refresh).findOne({ tokenHash: hash });
  if (refresh && refresh.clientId === client.clientId) {
    await revokeGrantTokens(db, refresh.grantId);
  }
}

export async function introspectToken(db, { client, token }) {
  const inactive = { active: false };
  if (typeof token !== 'string' || !token) return inactive;
  const hash = fingerprint(token);

  const access = await db.collection(COL.access).findOne({ tokenHash: hash });
  const rec = access || (await db.collection(COL.refresh).findOne({ tokenHash: hash }));
  if (!rec || rec.clientId !== client.clientId) return inactive;
  if (rec.revokedAt || rec.rotatedAt) return inactive;
  if (rec.expiresAt && new Date(rec.expiresAt).getTime() <= Date.now()) return inactive;
  const grant = await db.collection(COL.grants).findOne({ grantId: rec.grantId });
  if (!grant || grant.status !== 'active') return inactive;

  return {
    active: true,
    scope: scopeToWire(rec.scopes),
    client_id: rec.clientId,
    token_type: 'Bearer',
    exp: Math.floor(new Date(rec.expiresAt).getTime() / 1000),
    iat: Math.floor(new Date(rec.createdAt).getTime() / 1000),
  };
}

// ---------------------------------------------------------------------------
// Bearer resolution for the resource server
// ---------------------------------------------------------------------------

/** Pull a Bearer token from the Authorization header (RFC 6750 §2.1). */
export function extractBearer(request) {
  const header = request.headers.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

/**
 * Resolve a bearer access token to its client + scopes for the resource server.
 * Throws invalid_token on any problem (unknown / revoked / expired / client not
 * usable / grant revoked). Best-effort updates lastUsedAt.
 */
export async function resolveBearer(db, token) {
  if (typeof token !== 'string' || !token) {
    throw new OAuthError(OAUTH_ERROR.INVALID_TOKEN, 'Missing bearer token', 401);
  }
  const rec = await db.collection(COL.access).findOne({ tokenHash: fingerprint(token) });
  if (!rec) throw new OAuthError(OAUTH_ERROR.INVALID_TOKEN, 'The access token is invalid', 401);
  if (rec.revokedAt) throw new OAuthError(OAUTH_ERROR.INVALID_TOKEN, 'The access token has been revoked', 401);
  if (rec.expiresAt && new Date(rec.expiresAt).getTime() <= Date.now()) {
    throw new OAuthError(OAUTH_ERROR.INVALID_TOKEN, 'The access token has expired', 401);
  }
  const client = await findClient(db, rec.clientId);
  if (!client || !clientIsUsable(client)) {
    throw new OAuthError(OAUTH_ERROR.INVALID_TOKEN, 'The client is no longer active', 401);
  }
  const grant = await db.collection(COL.grants).findOne({ grantId: rec.grantId });
  if (!grant || grant.status !== 'active') {
    throw new OAuthError(OAUTH_ERROR.INVALID_TOKEN, 'Access has been revoked', 401);
  }
  db.collection(COL.access)
    .updateOne({ _id: rec._id }, { $set: { lastUsedAt: new Date() } })
    .catch(() => {});
  return { token: rec, client, grant, scopes: Array.isArray(rec.scopes) ? rec.scopes : [] };
}

/** Stable hash of a token for correlating audit entries without storing it. */
export function auditTokenRef(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex').slice(0, 12);
}

/**
 * Append query params to a (already-validated, registered) redirect URI without
 * disturbing any params it already carries. Used to hand `code`+`state` or an
 * `error` back to the client per RFC 6749.
 */
export function buildRedirectUrl(redirectUri, params) {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  return url.href;
}
