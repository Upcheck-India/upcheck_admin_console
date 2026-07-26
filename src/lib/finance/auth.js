// src/lib/finance/auth.js
// Shared authentication / authorization for finance routes. Replaces the
// getUserFromToken + isAdminLike block that was copy-pasted into ~13 route
// files, and adds: bounded session validation, a CSRF (same-origin) guard for
// state-changing requests, and small input-sanitization helpers.
import { NextResponse } from 'next/server';
import clientPromise from '../mongodb';
import { FinanceError } from './tx';

// Absolute session lifetime (matches ADMIN_SESSION_MAX_AGE / the admin_token
// cookie: 2h). Enforced server-side as defense in depth when an admin_sessions
// record is present.
const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function isAdminLike(user) {
  return !!user && (user.role === 'Admin' || user.role === 'Console admin');
}

/**
 * Resolve the authenticated admin user from the admin_token cookie, validating
 * that the session is still active and not older than the absolute lifetime.
 * Returns the user document (id/email/username/role) or null.
 */
export async function getFinanceUser(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;
    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, username: 1, role: 1 } }
    );
    if (!user) return null;

    // Authoritative session check + absolute-age enforcement. If no session
    // record exists (legacy token) we fall back to the token match above so we
    // don't lock out existing users.
    const session = await db.collection('admin_sessions').findOne(
      { token },
      { projection: { createdAt: 1 } }
    );
    if (session?.createdAt) {
      const age = Date.now() - new Date(session.createdAt).getTime();
      if (age > SESSION_MAX_AGE_MS) return null; // expired
    }
    return user;
  } catch {
    return null;
  }
}

/**
 * Guard for finance route handlers. Usage:
 *   const { user, response } = await requireFinanceAdmin(request, { mutation: true });
 *   if (response) return response;
 * `mutation: true` additionally enforces the same-origin (CSRF) check.
 */
export async function requireFinanceAdmin(request, { mutation = false } = {}) {
  const user = await getFinanceUser(request);
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!isAdminLike(user)) {
    return { user: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  if (mutation) {
    const originError = checkSameOrigin(request);
    if (originError) return { user, response: originError };
  }
  return { user, response: null };
}

/**
 * CSRF defense for cookie-authenticated mutations: the request's Origin (or
 * Referer) host must match the Host it was sent to. Returns a NextResponse on
 * failure, or null when the request is same-origin.
 */
export function checkSameOrigin(request) {
  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const source = origin || referer;
  // Some same-origin requests omit Origin; only reject when a cross-origin
  // source is explicitly present.
  if (!source) return null;
  try {
    const url = new URL(source);
    if (host && url.host !== host) {
      return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  return null;
}

/** Trim and hard-cap a string field; returns '' for non-strings. */
export function capString(value, max = 500) {
  if (typeof value !== 'string') return '';
  const t = value.trim();
  return t.length > max ? t.slice(0, max) : t;
}

/** Sanitize a tags array: strings only, trimmed, de-duped, capped. */
export function capTags(tags, { maxTags = 30, maxLen = 40 } = {}) {
  if (!Array.isArray(tags)) return [];
  const out = [];
  const seen = new Set();
  for (const t of tags) {
    if (typeof t !== 'string') continue;
    const v = t.trim().slice(0, maxLen);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= maxTags) break;
  }
  return out;
}

/** Parse and clamp a list `limit` query param. */
export function parseLimit(raw, { def = 200, max = 1000 } = {}) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}
