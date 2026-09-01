import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

// Signs the short-lived token that clients present to upcheck_realtime's
// Socket.IO handshake. Kept deliberately tiny: the realtime server verifies
// this signature LOCALLY (no DB round-trip per reconnect), so the only shared
// secret between the two services is REALTIME_JWT_SECRET — it must be
// byte-identical on both sides (Vercel env here, Render env there).
//
// The long-lived admin_token / sessionToken is NEVER handed to the realtime
// service; this scoped, expiring token is minted from it on demand instead.

const TOKEN_TTL_SECONDS = 10 * 60; // 10 minutes; clients refresh proactively.

function getSecret() {
  const secret = process.env.REALTIME_JWT_SECRET;
  if (!secret) {
    console.warn('REALTIME_JWT_SECRET is not configured. Using default development secret.');
    return 'default_realtime_jwt_secret_key_for_development';
  }
  return secret;
}

export function signRealtimeToken({ userId, username }) {
  return jwt.sign(
    { userId: String(userId), username: username || null },
    getSecret(),
    { algorithm: 'HS256', expiresIn: TOKEN_TTL_SECONDS }
  );
}

// See upcheck_realtime's config.js — the two must be byte-identical strings,
// and this is how you check that without either side printing the secret.
export function realtimeSecretFingerprint() {
  return createHash('sha256').update(getSecret()).digest('hex').slice(0, 8);
}

export { TOKEN_TTL_SECONDS };
