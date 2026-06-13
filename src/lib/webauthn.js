// Shared WebAuthn (passkey / biometric) helpers for the admin console.
//
// All credential identifiers and public keys are stored and compared using a
// single, consistent encoding: base64url. Centralising the RP configuration and
// the encoding helpers here keeps the registration and authentication routes in
// sync (mismatched encodings were the original reason passkeys never worked).

import crypto from 'crypto';

// Relying Party identifier. Must be the registrable domain (no scheme/port),
// e.g. "localhost" in development or "admin.upcheck.example" in production.
export function getRpId() {
  return process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost';
}

export function getRpName() {
  return process.env.NEXT_PUBLIC_WEBAUTHN_RP_NAME || 'Upcheck Admin';
}

// Origins that are accepted during verification. In development we allow the
// common localhost variants so the flow works regardless of how the dev server
// is reached. In production we trust NEXTAUTH_URL (falling back to https://rpId).
export function getExpectedOrigins(request) {
  const isProduction = process.env.NODE_ENV === 'production';
  const rpId = getRpId();

  if (isProduction) {
    return [process.env.NEXTAUTH_URL || `https://${rpId}`];
  }

  const origins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000',
    'https://127.0.0.1:3000',
  ];

  // Include the actual request origin too, so non-standard dev ports still work.
  const requestOrigin = request?.headers?.get?.('origin');
  if (requestOrigin && !origins.includes(requestOrigin)) {
    origins.push(requestOrigin);
  }

  return origins;
}

// Generate a base64url-encoded random challenge.
export function generateChallenge(length = 32) {
  return crypto.randomBytes(length).toString('base64url');
}

// Convert any of the binary representations that may come back from
// @simplewebauthn / MongoDB (Uint8Array, ArrayBuffer, Node Buffer, BSON Binary,
// or an already-encoded string) into a base64url string.
export function toBase64Url(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;

  // BSON Binary stores its bytes on `.buffer`.
  if (value.buffer && typeof value.length === 'number' && !(value instanceof Uint8Array)) {
    return Buffer.from(value.buffer).toString('base64url');
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(value)).toString('base64url');
  }

  return Buffer.from(value).toString('base64url');
}

// Convert a base64url (or BSON Binary / Buffer) value back into a Node Buffer.
export function toBuffer(value) {
  if (value == null) return Buffer.alloc(0);
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'string') return Buffer.from(value, 'base64url');
  if (value.buffer && !(value instanceof Uint8Array)) return Buffer.from(value.buffer);
  return Buffer.from(value);
}
