import jwt from 'jsonwebtoken';

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
    throw new Error('REALTIME_JWT_SECRET is not configured');
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

export { TOKEN_TTL_SECONDS };
