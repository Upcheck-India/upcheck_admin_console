// src/lib/oauth/errors.js
//
// Error model for the "Upcheck ERP Data OAuth" service. Mirrors the finance
// module's FinanceError pattern (a discriminable Error subclass carrying an HTTP
// status), but adds a machine-readable OAuth 2.0 error `code` so protocol
// endpoints can emit RFC 6749 / RFC 6750 compliant `{ error, error_description }`
// bodies. Business/validation failures are thrown as OAuthError and converted to
// a response at the route boundary — never leaking stack traces or internals.

import { NextResponse } from 'next/server';

// RFC 6749 §5.2 (token endpoint) + §4.1.2.1 (authorize) + RFC 6750 §3.1
// (bearer / resource server) error codes we actually use. Keeping them as a
// frozen map means typos become undefined at the call site instead of shipping
// a wrong wire value.
export const OAUTH_ERROR = Object.freeze({
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  INVALID_GRANT: 'invalid_grant',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
  INVALID_SCOPE: 'invalid_scope',
  ACCESS_DENIED: 'access_denied',
  SERVER_ERROR: 'server_error',
  TEMPORARILY_UNAVAILABLE: 'temporarily_unavailable',
  // RFC 6750 resource-server codes
  INVALID_TOKEN: 'invalid_token',
  INSUFFICIENT_SCOPE: 'insufficient_scope',
});

// Default HTTP status per error code. Overridable per-throw.
const DEFAULT_STATUS = {
  invalid_request: 400,
  invalid_client: 401,
  invalid_grant: 400,
  unauthorized_client: 403,
  unsupported_grant_type: 400,
  unsupported_response_type: 400,
  invalid_scope: 400,
  access_denied: 403,
  server_error: 500,
  temporarily_unavailable: 503,
  invalid_token: 401,
  insufficient_scope: 403,
};

/**
 * A protocol / validation error that should be surfaced to the caller with a
 * specific OAuth error code + HTTP status. Never carries sensitive detail.
 */
export class OAuthError extends Error {
  constructor(code, description, status) {
    super(description || code);
    this.name = 'OAuthError';
    this.code = code || OAUTH_ERROR.SERVER_ERROR;
    this.status = status || DEFAULT_STATUS[this.code] || 400;
    this.description = description || '';
    this.isOAuthError = true;
  }
}

/** Convenience constructors for the codes we throw most. */
export const invalidRequest = (d, s) => new OAuthError(OAUTH_ERROR.INVALID_REQUEST, d, s);
export const invalidClient = (d, s) => new OAuthError(OAUTH_ERROR.INVALID_CLIENT, d, s);
export const invalidGrant = (d, s) => new OAuthError(OAUTH_ERROR.INVALID_GRANT, d, s);
export const invalidScope = (d, s) => new OAuthError(OAUTH_ERROR.INVALID_SCOPE, d, s);
export const accessDenied = (d, s) => new OAuthError(OAUTH_ERROR.ACCESS_DENIED, d, s);
export const invalidToken = (d, s) => new OAuthError(OAUTH_ERROR.INVALID_TOKEN, d, s);
export const insufficientScope = (d, s) => new OAuthError(OAUTH_ERROR.INSUFFICIENT_SCOPE, d, s);

/**
 * Convert any thrown value into an OAuth-compliant JSON response. Known
 * OAuthErrors pass through their code/description; anything else becomes a
 * generic server_error so internals never leak. For 401s from a client or token
 * failure we also set WWW-Authenticate per RFC 6750.
 */
export function oauthErrorResponse(err, { bearer = false } = {}) {
  const isKnown = err && err.isOAuthError;
  const code = isKnown ? err.code : OAUTH_ERROR.SERVER_ERROR;
  const status = isKnown ? err.status : 500;
  const description = isKnown ? err.description : 'An unexpected error occurred';
  if (!isKnown) {
    // Log the real cause server-side; never send it to the client.
    console.error('oauth unexpected error', err);
  }
  const body = { error: code };
  if (description) body.error_description = description;

  const headers = {};
  if (status === 401) {
    if (bearer) {
      headers['WWW-Authenticate'] =
        `Bearer error="${code}"${description ? `, error_description="${description.replace(/"/g, "'")}"` : ''}`;
    } else {
      headers['WWW-Authenticate'] = 'Basic realm="oauth"';
    }
  }
  return NextResponse.json(body, { status, headers });
}
