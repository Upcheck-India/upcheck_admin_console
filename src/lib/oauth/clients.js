// src/lib/oauth/clients.js
//
// Registered-application (OAuth client) helpers: validation, safe serialization,
// and status semantics. A client is a first-party app that has been registered
// and (before it can obtain any token) verified by an admin.
//
// Security-relevant invariants enforced here:
//   • redirect_uri is validated at registration AND matched EXACTLY at
//     /authorize — no wildcards, no path-prefix matching, no fragments. This is
//     the primary defense against authorization-code interception.
//   • The client secret's fingerprint is never serialized out.
import { OAuthError, OAUTH_ERROR } from './errors';
import { normalizeScopes } from './scopes';
import { secretHint } from './crypto';

export const CLIENT_STATUS = Object.freeze({
  PENDING: 'pending', // registered, not yet verified — cannot obtain tokens
  ACTIVE: 'active', // verified & enabled
  SUSPENDED: 'suspended', // temporarily disabled by an admin
  REVOKED: 'revoked', // permanently disabled; tokens rejected
});

const MAX_REDIRECT_URIS = 10;
const MAX_URI_LEN = 2000;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Parse + fully validate a redirect URI, returning its canonical href, or throw
 * OAuthError(invalid_request). Enforced rules (defense against open-redirect /
 * code-interception):
 *   • Absolute http(s) URL that actually parses.
 *   • https required, EXCEPT http on loopback (localhost/127.0.0.1/::1) for dev.
 *   • No URL fragment (#…) — reserved for the client, never registrable.
 *   • No embedded credentials (user:pass@host) — a common phishing/leak vector.
 *   • No wildcard characters — matching is exact, never pattern-based.
 *   • Length-bounded.
 * The returned value is the canonical form used BOTH for storage and comparison,
 * so a trailing-slash / case / encoding difference can't silently break matching.
 */
export function canonicalizeRedirectUri(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new OAuthError(OAUTH_ERROR.INVALID_REQUEST, 'redirect_uri is required');
  }
  const value = raw.trim();
  if (value.length > MAX_URI_LEN) {
    throw new OAuthError(OAUTH_ERROR.INVALID_REQUEST, 'redirect_uri is too long');
  }
  if (value.includes('*')) {
    throw new OAuthError(OAUTH_ERROR.INVALID_REQUEST, 'redirect_uri must not contain wildcards; register each exact URI');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new OAuthError(OAUTH_ERROR.INVALID_REQUEST, 'redirect_uri must be an absolute URL (including scheme and host)');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new OAuthError(OAUTH_ERROR.INVALID_REQUEST, 'redirect_uri must use the https scheme');
  }
  if (url.hash) {
    throw new OAuthError(OAUTH_ERROR.INVALID_REQUEST, 'redirect_uri must not contain a fragment (#…)');
  }
  if (url.username || url.password) {
    throw new OAuthError(OAUTH_ERROR.INVALID_REQUEST, 'redirect_uri must not embed credentials (user:pass@host)');
  }
  const isLoopback = LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !isLoopback) {
    throw new OAuthError(
      OAUTH_ERROR.INVALID_REQUEST,
      'redirect_uri must use https (plain http is only allowed for localhost during development)'
    );
  }
  return url.href;
}

// Back-compat alias.
export const validateRedirectUri = canonicalizeRedirectUri;

/** Validate & normalize an array of redirect URIs (deduped, capped). */
export function validateRedirectUris(input) {
  const list = Array.isArray(input) ? input : [input];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const uri = canonicalizeRedirectUri(raw);
    if (seen.has(uri)) continue;
    seen.add(uri);
    out.push(uri);
    if (out.length > MAX_REDIRECT_URIS) {
      throw new OAuthError(OAUTH_ERROR.INVALID_REQUEST, `Too many redirect URIs (max ${MAX_REDIRECT_URIS})`);
    }
  }
  if (!out.length) {
    throw new OAuthError(OAUTH_ERROR.INVALID_REQUEST, 'At least one redirect_uri is required');
  }
  return out;
}

/**
 * Match an incoming redirect_uri against the client's registered set. The match
 * is EXACT on the CANONICAL form — the incoming value is canonicalized with the
 * same rules used at registration, so a trailing slash / case / encoding
 * difference neither breaks a legitimate match nor loosens it into a
 * prefix/substring match. Returns the canonical matched URI, or null.
 */
export function matchRedirectUri(client, redirectUri) {
  if (!client || !Array.isArray(client.redirectUris) || typeof redirectUri !== 'string') return null;
  let canonical;
  try {
    canonical = canonicalizeRedirectUri(redirectUri);
  } catch {
    return null;
  }
  return client.redirectUris.includes(canonical) ? canonical : null;
}

/** Boolean convenience over matchRedirectUri. */
export function redirectUriRegistered(client, redirectUri) {
  return matchRedirectUri(client, redirectUri) !== null;
}

/** Whether a client is allowed to obtain / use tokens right now. */
export function clientIsUsable(client) {
  return !!client && client.status === CLIENT_STATUS.ACTIVE;
}

/**
 * Public, admin-console-safe view of a client. Never includes the secret
 * fingerprint. `includeSecret` is only ever set at registration / rotation to
 * surface the one-time plaintext (which is NOT read from the DB — it's passed in).
 */
export function sanitizeClient(doc, { plaintextSecret = null } = {}) {
  if (!doc) return null;
  const safe = {
    id: doc._id ? String(doc._id) : null,
    clientId: doc.clientId,
    name: doc.name,
    description: doc.description || '',
    homepageUrl: doc.homepageUrl || '',
    logoUrl: doc.logoUrl || '',
    redirectUris: Array.isArray(doc.redirectUris) ? doc.redirectUris : [],
    allowedScopes: Array.isArray(doc.allowedScopes) ? doc.allowedScopes : [],
    grantTypes: Array.isArray(doc.grantTypes) ? doc.grantTypes : ['authorization_code', 'refresh_token'],
    isFirstParty: doc.isFirstParty !== false,
    status: doc.status || CLIENT_STATUS.PENDING,
    ownerEmail: doc.ownerEmail || '',
    secretLast4: doc.secretLast4 || '',
    createdBy: doc.createdBy || null,
    verifiedBy: doc.verifiedBy || null,
    verifiedAt: doc.verifiedAt || null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
  if (plaintextSecret) {
    // Shown exactly once, right after generation. Never persisted in the clear.
    safe.clientSecret = plaintextSecret;
    safe.secretHint = secretHint(plaintextSecret);
  }
  return safe;
}

/** Normalize requested scopes for a client against the global catalogue. */
export function sanitizeAllowedScopes(input) {
  return normalizeScopes(input);
}
