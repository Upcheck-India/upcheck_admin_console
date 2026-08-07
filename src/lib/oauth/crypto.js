// src/lib/oauth/crypto.js
//
// Cryptographic primitives for the OAuth service. Design goals:
//   • Tokens & client secrets are HIGH-ENTROPY random values (>=256-bit). The
//     raw value is shown to the client exactly once and NEVER stored. We persist
//     only a one-way fingerprint, so a database dump can neither reveal nor
//     forge a usable credential.
//   • Verification is a constant-time compare of fingerprints (no early-exit
//     timing oracle).
//   • PKCE (RFC 7636) S256 verification for the authorization-code flow.
//
// An optional server secret hardens the fingerprint into a keyed HMAC (so a DB
// leak alone can't even be used with a precomputed table — irrelevant for
// 256-bit randoms, but defense in depth and free):
//   OAUTH_TOKEN_SECRET — optional string. If absent we fall back to a plain
//                        SHA-256 of the token, which is still a safe one-way
//                        function for high-entropy inputs, so the feature works
//                        with zero configuration.
import crypto from 'node:crypto';

// URL-safe, no padding — suitable for tokens carried in headers / query / JSON.
function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A cryptographically random, URL-safe opaque token (default 32 bytes = 256-bit). */
export function randomToken(bytes = 32) {
  return base64url(crypto.randomBytes(bytes));
}

/**
 * Generate a public client identifier. Prefixed so it's recognisable in logs
 * and never confusable with a secret. Not itself a credential.
 */
export function generateClientId() {
  return `ucid_${base64url(crypto.randomBytes(12))}`;
}

/**
 * Generate a client secret. Prefixed `ucsk_` (Upcheck secret key). Returned once
 * to the caller; only its fingerprint() is persisted.
 */
export function generateClientSecret() {
  return `ucsk_${base64url(crypto.randomBytes(32))}`;
}

function tokenKey() {
  const raw = process.env.OAUTH_TOKEN_SECRET;
  if (raw && typeof raw === 'string' && raw.trim()) {
    return crypto.createHash('sha256').update(`oauth-token:${raw.trim()}`).digest();
  }
  return null;
}

/**
 * One-way fingerprint (hex) of a secret/token for storage & lookup. Keyed HMAC
 * when OAUTH_TOKEN_SECRET is set, else a plain SHA-256. Deterministic, so it
 * doubles as the indexed lookup key. Never reversible.
 */
export function fingerprint(value) {
  if (value == null || value === '') return null;
  const key = tokenKey();
  const input = String(value);
  if (key) return crypto.createHmac('sha256', key).update(input).digest('hex');
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Constant-time compare of two hex fingerprints. */
export function fingerprintsEqual(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Last 4 chars of a secret, for non-sensitive display (e.g. "…a1b2"). */
export function secretHint(value) {
  const s = String(value || '');
  return s.length >= 4 ? s.slice(-4) : '';
}

// ---------------------------------------------------------------------------
// PKCE (RFC 7636)
// ---------------------------------------------------------------------------

// A valid code_verifier is 43–128 chars from the unreserved set [A-Za-z0-9-._~].
const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
// A code_challenge (S256) is base64url(SHA-256(verifier)) => 43 chars, no pad.
const CHALLENGE_RE = /^[A-Za-z0-9\-_]{43}$/;

export function isValidCodeChallenge(challenge) {
  return typeof challenge === 'string' && CHALLENGE_RE.test(challenge);
}

export function isValidCodeVerifier(verifier) {
  return typeof verifier === 'string' && VERIFIER_RE.test(verifier);
}

/**
 * Verify a PKCE code_verifier against a stored S256 code_challenge.
 * Only S256 is supported (the insecure `plain` method is intentionally
 * rejected). Constant-time compare of the derived challenge.
 */
export function verifyPkceS256(verifier, storedChallenge) {
  if (!isValidCodeVerifier(verifier) || !isValidCodeChallenge(storedChallenge)) return false;
  const derived = base64url(crypto.createHash('sha256').update(verifier).digest());
  const a = Buffer.from(derived);
  const b = Buffer.from(storedChallenge);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
