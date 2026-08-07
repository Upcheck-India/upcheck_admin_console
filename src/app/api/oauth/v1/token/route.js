// POST /api/oauth/v1/token
//
// The OAuth 2.0 token endpoint. Supports:
//   • grant_type=authorization_code  (with PKCE code_verifier)
//   • grant_type=refresh_token       (rotating, with reuse detection)
// Confidential-client authentication via HTTP Basic or client_secret_post.
// Accepts application/x-www-form-urlencoded (the spec default) or JSON.
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import {
  authenticateClient,
  extractClientCredentials,
  exchangeAuthorizationCode,
  refreshAccessToken,
} from '../../../../../lib/oauth/service';
import { matchRedirectUri } from '../../../../../lib/oauth/clients';
import { OAuthError, OAUTH_ERROR, invalidGrant, oauthErrorResponse } from '../../../../../lib/oauth/errors';
import { recordOAuthAudit, clientIpFrom } from '../../../../../lib/oauth/audit';
import { rateLimit, limiterKey, tooManyRequests } from '../../../../../lib/oauth/ratelimit';

export const dynamic = 'force-dynamic';

async function parseBody(request) {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    return request.json().catch(() => ({}));
  }
  // Default: form-urlencoded (also handles missing content-type gracefully).
  try {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const obj = {};
    for (const [k, v] of params.entries()) obj[k] = v;
    return obj;
  } catch {
    return {};
  }
}

export async function POST(request) {
  const client = await clientPromise;
  const db = client.db('resources');
  const ip = clientIpFrom(request);
  try {
    const body = await parseBody(request);
    const grantType = body?.grant_type || '';

    const creds = extractClientCredentials(request, body);
    // Rate-limit per client id + ip so a leaked-secret guesser is throttled.
    const rl = await rateLimit(db, {
      key: limiterKey('token', request, creds.clientId || 'anon'),
      limit: 30,
      windowSeconds: 60,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfter);

    const app = await authenticateClient(db, creds); // throws invalid_client / unauthorized_client

    if (grantType === 'authorization_code') {
      const code = body?.code || '';
      const codeVerifier = body?.code_verifier || '';
      // redirect_uri must be present, registered, and equal (canonically) to the
      // one bound to the code. Canonicalize here so the comparison in the service
      // is apples-to-apples with the stored value.
      const matchedRedirect = matchRedirectUri(app, body?.redirect_uri || '');
      if (!matchedRedirect) {
        throw invalidGrant('redirect_uri is missing or not registered for this client');
      }
      const { response: tokenBody, scopes } = await exchangeAuthorizationCode(db, {
        client: app,
        code,
        redirectUri: matchedRedirect,
        codeVerifier,
      });
      await recordOAuthAudit(db, { action: 'token.issue', clientId: app.clientId, ip, meta: { grant: 'authorization_code', scopes } });
      return json(tokenBody);
    }

    if (grantType === 'refresh_token') {
      const refreshToken = body?.refresh_token || '';
      const requestedScope = typeof body?.scope === 'string' ? body.scope : '';
      const { response: tokenBody, scopes } = await refreshAccessToken(db, {
        client: app,
        refreshToken,
        requestedScope,
      });
      await recordOAuthAudit(db, { action: 'token.refresh', clientId: app.clientId, ip, meta: { scopes } });
      return json(tokenBody);
    }

    throw new OAuthError(OAUTH_ERROR.UNSUPPORTED_GRANT_TYPE, `Unsupported grant_type '${grantType || '(none)'}'`);
  } catch (err) {
    // Audit failed token attempts (helps spot abuse) without leaking specifics.
    if (err && err.isOAuthError && (err.code === OAUTH_ERROR.INVALID_CLIENT || err.code === OAUTH_ERROR.INVALID_GRANT)) {
      recordOAuthAudit(db, { action: 'token.deny', ip, ok: false, meta: { code: err.code } }).catch(() => {});
    }
    return oauthErrorResponse(err);
  }
}

// Token responses must not be cached (RFC 6749 §5.1).
function json(body) {
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } });
}
