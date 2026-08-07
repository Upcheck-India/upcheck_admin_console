// GET /api/oauth/v1/authorize
//
// The OAuth 2.0 authorization endpoint (Authorization Code + PKCE). The client's
// browser is redirected here. We validate every parameter, then persist a
// pending authorization request and redirect the user to the in-app consent
// screen. No code is issued until an admin approves (see authorize/decision).
//
// Error handling follows RFC 6749 §4.1.2.1:
//   • If client_id is unknown OR redirect_uri is missing/unregistered, we MUST
//     NOT redirect (that would be an open redirector) — we render an error page.
//   • Otherwise, parameter errors are reported by redirecting back to the
//     registered redirect_uri with ?error=...&state=...
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { findClient, createAuthRequest, buildRedirectUrl } from '../../../../../lib/oauth/service';
import { matchRedirectUri, CLIENT_STATUS } from '../../../../../lib/oauth/clients';
import { grantableScopes } from '../../../../../lib/oauth/scopes';
import { isValidCodeChallenge } from '../../../../../lib/oauth/crypto';
import { recordOAuthAudit, clientIpFrom } from '../../../../../lib/oauth/audit';
import { rateLimit, limiterKey, tooManyRequests } from '../../../../../lib/oauth/ratelimit';
import { OAUTH_ERROR } from '../../../../../lib/oauth/errors';

export const dynamic = 'force-dynamic';

// Minimal, self-contained HTML error page for the un-redirectable cases. No user
// input is interpolated unescaped.
function htmlError(title, detail, status = 400) {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Authorization error</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}.card{max-width:28rem;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:2rem;box-shadow:0 10px 30px rgba(2,6,23,.06)}h1{font-size:1.15rem;margin:0 0 .5rem}p{color:#475569;line-height:1.5;margin:.25rem 0}.tag{display:inline-block;font:600 .7rem/1 ui-monospace,monospace;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;padding:.35rem .5rem;border-radius:8px;margin-bottom:1rem}</style></head><body><div class="card"><div class="tag">Upcheck ERP Data OAuth</div><h1>${esc(title)}</h1><p>${esc(detail)}</p><p style="margin-top:1rem;color:#94a3b8;font-size:.85rem">If you are the developer, check your <code>client_id</code> and <code>redirect_uri</code> against your registration in the Developer console.</p></div></body></html>`;
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function GET(request) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');

    // Throttle by IP to blunt client-id/redirect enumeration.
    const rl = await rateLimit(db, { key: limiterKey('authorize', request), limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfter);

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id') || '';
    const redirectUri = searchParams.get('redirect_uri') || '';
    const responseType = searchParams.get('response_type') || '';
    const scope = searchParams.get('scope') || '';
    const state = searchParams.get('state') || '';
    const codeChallenge = searchParams.get('code_challenge') || '';
    const codeChallengeMethod = searchParams.get('code_challenge_method') || '';

    // --- Un-redirectable validation: client + redirect_uri ---
    const app = await findClient(db, clientId);
    if (!app) {
      return htmlError('Unknown application', 'The client_id in this request is not registered.');
    }
    // Exact match on the canonical form; matchedRedirect is what we bind the
    // code to and where we send the user back.
    const matchedRedirect = matchRedirectUri(app, redirectUri);
    if (!matchedRedirect) {
      return htmlError(
        'Invalid redirect URI',
        'The redirect_uri does not exactly match a URI registered for this application.'
      );
    }

    // From here we can safely redirect protocol errors back to the client.
    const errorRedirect = (error, description) =>
      NextResponse.redirect(buildRedirectUrl(matchedRedirect, { error, error_description: description, state: state || null }), { status: 302 });

    if (app.status === CLIENT_STATUS.REVOKED || app.status === CLIENT_STATUS.SUSPENDED) {
      return errorRedirect(OAUTH_ERROR.UNAUTHORIZED_CLIENT, 'This application is not currently permitted to request access.');
    }
    if (app.status !== CLIENT_STATUS.ACTIVE) {
      return errorRedirect(OAUTH_ERROR.UNAUTHORIZED_CLIENT, 'This application has not completed verification.');
    }
    if (responseType !== 'code') {
      return errorRedirect(OAUTH_ERROR.UNSUPPORTED_RESPONSE_TYPE, "Only response_type=code is supported.");
    }
    // PKCE is MANDATORY and only S256 is accepted (plain is rejected).
    if (codeChallengeMethod !== 'S256') {
      return errorRedirect(OAUTH_ERROR.INVALID_REQUEST, 'code_challenge_method must be S256.');
    }
    if (!isValidCodeChallenge(codeChallenge)) {
      return errorRedirect(OAUTH_ERROR.INVALID_REQUEST, 'A valid S256 code_challenge is required.');
    }
    const scopes = grantableScopes(scope.split(/\s+/), app.allowedScopes);
    if (!scopes.length) {
      return errorRedirect(OAUTH_ERROR.INVALID_SCOPE, 'None of the requested scopes are permitted for this application.');
    }

    const requestId = await createAuthRequest(db, {
      clientId: app.clientId,
      redirectUri: matchedRedirect,
      scopes,
      state,
      codeChallenge,
    });

    await recordOAuthAudit(db, {
      action: 'authorize.request',
      clientId: app.clientId,
      ip: clientIpFrom(request),
      meta: { scopes, requestId },
    });

    // Hand off to the in-app consent screen; the admin logs in there if needed.
    const consentUrl = new URL(`/organization/api/consent?rid=${encodeURIComponent(requestId)}`, request.url);
    return NextResponse.redirect(consentUrl, { status: 302 });
  } catch (e) {
    console.error('GET /api/oauth/v1/authorize error', e);
    return htmlError('Authorization error', 'An unexpected error occurred while starting authorization.', 500);
  }
}
