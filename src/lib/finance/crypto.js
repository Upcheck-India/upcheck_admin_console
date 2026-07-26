// src/lib/finance/crypto.js
//
// Security primitives for sensitive finance data (bank account numbers).
//
// Design (matches the product decision "masked + encrypted, never retrievable,
// but verifiable"):
//   • ENCRYPT AT REST  — AES-256-GCM. Protects a database dump. The ciphertext
//     is NEVER returned by any API and NEVER logged. Decryption exists only so
//     a future, deliberate, audited server-side operation could use it; no HTTP
//     route exposes decryptSecret().
//   • VERIFY WITHOUT REVEALING — a keyed HMAC-SHA-256 "fingerprint" of the
//     normalized number. Later, an admin can submit an account number and the
//     server re-fingerprints it and compares — proving "this is the account on
//     file" without ever sending the stored number back. Also used to detect a
//     duplicate account being added.
//   • DISPLAY — only the last 4 digits (+ a masked string) are ever surfaced.
//
// Keys come from the environment and are required only when these functions are
// actually called (so a missing key never breaks build/import, only the bank
// feature at runtime):
//   FINANCE_ENC_KEY   — 32 bytes, as 64 hex chars or base64. Used for AES-256-GCM.
//   FINANCE_HMAC_KEY  — optional; any string. If absent, derived from ENC key
//                       via HKDF-like SHA-256 so a single secret still works.
import crypto from 'node:crypto';
import { FinanceError } from './tx';

const ENC_ALGO = 'aes-256-gcm';
const VERSION = 'v1';

/** Parse a 32-byte key from hex or base64. Throws a 500 FinanceError if unusable. */
function parseKey(raw, name) {
  if (!raw || typeof raw !== 'string') {
    throw new FinanceError(`${name} is not configured on the server`, 500);
  }
  let buf = null;
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    buf = Buffer.from(trimmed, 'hex');
  } else {
    try {
      const b = Buffer.from(trimmed, 'base64');
      if (b.length === 32) buf = b;
    } catch {
      buf = null;
    }
  }
  if (!buf || buf.length !== 32) {
    throw new FinanceError(`${name} must be 32 bytes (64 hex chars or base64)`, 500);
  }
  return buf;
}

function getEncKey() {
  return parseKey(process.env.FINANCE_ENC_KEY, 'FINANCE_ENC_KEY');
}

function getHmacKey() {
  const explicit = process.env.FINANCE_HMAC_KEY;
  if (explicit && typeof explicit === 'string' && explicit.trim()) {
    // Domain-separate so this can't collide with any other HMAC use.
    return crypto.createHash('sha256').update(`finance-hmac:${explicit.trim()}`).digest();
  }
  // Derive from the encryption key (distinct domain string) so a single
  // configured secret is enough.
  const enc = getEncKey();
  return crypto.createHash('sha256').update(Buffer.concat([enc, Buffer.from(':finance-hmac')])).digest();
}

/** True when the server is configured to store bank details. Never throws. */
export function financeCryptoConfigured() {
  try {
    getEncKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypt a secret string. Returns a self-describing compact string:
 *   "v1:<iv b64>:<authTag b64>:<ciphertext b64>"
 * Store this verbatim; never return it to a client.
 */
export function encryptSecret(plaintext) {
  if (plaintext == null || plaintext === '') return null;
  const key = getEncKey();
  const iv = crypto.randomBytes(12); // 96-bit nonce for GCM
  const cipher = crypto.createCipheriv(ENC_ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/**
 * Decrypt a value produced by encryptSecret(). SERVER-ONLY. Intentionally not
 * wired to any HTTP response. Throws on tamper (GCM auth failure).
 */
export function decryptSecret(payload) {
  if (!payload || typeof payload !== 'string') return null;
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new FinanceError('Malformed encrypted value', 500);
  }
  const key = getEncKey();
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ct = Buffer.from(parts[3], 'base64');
  const decipher = crypto.createDecipheriv(ENC_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

/** Strip spaces / dashes and uppercase — canonical form for hashing & last4. */
export function normalizeAccountNumber(value) {
  return String(value == null ? '' : value).replace(/[\s-]+/g, '').toUpperCase();
}

/**
 * Keyed HMAC-SHA-256 fingerprint (hex) of a normalized account number. Same
 * input + same key → same fingerprint, so it enables equality checks
 * (verification, de-duplication) without storing or revealing the number. Not
 * reversible.
 */
export function fingerprint(value) {
  const norm = normalizeAccountNumber(value);
  if (!norm) return null;
  return crypto.createHmac('sha256', getHmacKey()).update(norm).digest('hex');
}

/** Constant-time compare of two fingerprints (hex strings). */
export function fingerprintsEqual(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** { last4, masked } for display. masked shows only the last 4 digits. */
export function maskAccountNumber(value) {
  const norm = normalizeAccountNumber(value);
  if (!norm) return { last4: '', masked: '' };
  const last4 = norm.slice(-4);
  const hiddenLen = Math.max(0, norm.length - 4);
  const masked = `${'•'.repeat(Math.min(hiddenLen, 12))}${last4}`;
  return { last4, masked };
}

/**
 * Build the persistable bank-detail fields from raw input. The raw account
 * number is consumed here and NEVER stored in the clear — only its ciphertext,
 * fingerprint and last4 leave this function.
 */
export function buildBankSecretFields(accountNumber) {
  const norm = normalizeAccountNumber(accountNumber);
  if (!norm) return null;
  const { last4, masked } = maskAccountNumber(norm);
  return {
    accountNumberEnc: encryptSecret(norm), // AES-256-GCM ciphertext (never exposed)
    accountNumberHash: fingerprint(norm), // HMAC fingerprint (verify / dedupe)
    accountNumberLast4: last4,
    accountNumberMasked: masked,
  };
}
