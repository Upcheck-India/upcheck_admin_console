// src/lib/oauth/ratelimit.js
//
// A small fixed-window rate limiter backed by Mongo, so it works across the
// stateless/serverless instances this app deploys to (an in-process counter
// would reset per cold start and per lambda). Each (key, window) is one document
// with an atomic $inc; a TTL index on `expiresAt` garbage-collects old windows.
//
// Used to blunt brute-force / abuse on the protocol endpoints (token, authorize)
// — it is a throttle, not an authz control, so a best-effort failure never
// blocks a legitimate request.
import { NextResponse } from 'next/server';

const COLLECTION = 'oauth_rate_limits';

/**
 * Count this hit against a fixed window. Returns
 *   { allowed, count, limit, retryAfter }
 * On any datastore error it fails OPEN (allowed:true) so an infra blip can't
 * lock everyone out — the limiter is defense-in-depth, not the security boundary.
 */
export async function rateLimit(db, { key, limit = 60, windowSeconds = 60 }) {
  try {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStartMs = Math.floor(now / windowMs) * windowMs;
    const _id = `${key}:${windowStartMs}`;
    // Driver v6 returns the (post-update) document directly, not { value }.
    const res = await db.collection(COLLECTION).findOneAndUpdate(
      { _id },
      {
        $inc: { count: 1 },
        $setOnInsert: {
          key,
          windowStart: new Date(windowStartMs),
          expiresAt: new Date(windowStartMs + windowMs),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
    const count = res?.count || 1;
    return {
      allowed: count <= limit,
      count,
      limit,
      retryAfter: Math.ceil((windowStartMs + windowMs - now) / 1000),
    };
  } catch (e) {
    console.error('oauth rateLimit failed (failing open)', e);
    return { allowed: true, count: 0, limit, retryAfter: 0 };
  }
}

/** RFC 6585 429 response with Retry-After. */
export function tooManyRequests(retryAfter, { bearer = false } = {}) {
  const body = { error: bearer ? 'invalid_request' : 'temporarily_unavailable', error_description: 'Rate limit exceeded. Slow down and retry later.' };
  return NextResponse.json(body, {
    status: 429,
    headers: { 'Retry-After': String(Math.max(1, retryAfter || 1)) },
  });
}

/** Build a stable limiter key from client IP + a bucket label. */
export function limiterKey(bucket, request, extra = '') {
  let ip = 'unknown';
  try {
    const xff = request.headers.get('x-forwarded-for');
    ip = (xff ? xff.split(',')[0] : request.headers.get('x-real-ip') || 'unknown').trim();
  } catch {
    /* ignore */
  }
  return `${bucket}:${ip}${extra ? `:${extra}` : ''}`;
}
