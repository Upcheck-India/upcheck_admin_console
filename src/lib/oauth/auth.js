// src/lib/oauth/auth.js
//
// Authentication / authorization for the OAuth *admin console* and the *consent*
// endpoints — i.e. the cookie-authenticated (admin_token) surface where a
// portal admin registers apps, verifies them, and approves connections.
//
// This is distinct from client/bearer authentication of the protocol endpoints
// (that lives in service.js). Mirrors src/lib/finance/auth.js: bounded session
// validation + a same-origin CSRF guard for state-changing requests.
import { NextResponse } from 'next/server';
import clientPromise from '../mongodb';

// Absolute session lifetime (matches ADMIN_SESSION_MAX_AGE / the admin_token
// cookie: 2h). Enforced as defense in depth when an admin_sessions record exists.
const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;

// The delegated permission that lets a non-admin manage the API ecosystem.
export const API_MANAGE_PERM = 'api.manage';

/**
 * May this user administer the OAuth ecosystem (register/verify apps, approve or
 * revoke connections)? Console admins and Admins always may; anyone else needs
 * the explicit `api.manage` permission.
 */
export function isOAuthAdmin(user) {
  if (!user) return false;
  if (user.role === 'Console admin' || user.role === 'Admin') return true;
  return Array.isArray(user.perms) && user.perms.includes(API_MANAGE_PERM);
}

/**
 * Resolve the authenticated admin from the admin_token cookie, validating that
 * the session is active and within the absolute lifetime. Returns the user
 * document ({ _id, email, username, role, perms }) or null.
 */
export async function getOAuthUser(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;
    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, username: 1, role: 1, perms: 1 } }
    );
    if (!user) return null;

    const session = await db.collection('admin_sessions').findOne(
      { token },
      { projection: { createdAt: 1 } }
    );
    if (session?.createdAt) {
      const age = Date.now() - new Date(session.createdAt).getTime();
      if (age > SESSION_MAX_AGE_MS) return null;
    }
    return user;
  } catch {
    return null;
  }
}

/**
 * Guard for OAuth admin-console route handlers. Usage:
 *   const { user, response } = await requireOAuthAdmin(request, { mutation: true });
 *   if (response) return response;
 */
export async function requireOAuthAdmin(request, { mutation = false } = {}) {
  const user = await getOAuthUser(request);
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!isOAuthAdmin(user)) {
    return {
      user: null,
      response: NextResponse.json(
        { error: 'Forbidden — requires an admin role or the api.manage permission' },
        { status: 403 }
      ),
    };
  }
  if (mutation) {
    const originError = checkSameOrigin(request);
    if (originError) return { user, response: originError };
  }
  return { user, response: null };
}

/**
 * CSRF defense for cookie-authenticated mutations: the request's Origin (or
 * Referer) host must match the Host. Returns a NextResponse on failure, else null.
 */
export function checkSameOrigin(request) {
  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const source = origin || referer;
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

/** Parse and clamp a list `limit` query param. */
export function parseLimit(raw, { def = 100, max = 500 } = {}) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}
