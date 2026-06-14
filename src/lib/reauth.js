// Re-authentication helper for sensitive actions.
//
// Before performing destructive or security-relevant operations (registering a
// passkey, deleting a passkey, generating backup codes) the server requires the
// user to have re-authenticated within the last REAUTH_WINDOW_MS milliseconds.
//
// Re-auth state is stored directly on the admin_users document so it works
// across serverless function instances without an extra session store.
//
// Fields written to the user document:
//   reauthAt      — ISO date string of last successful re-auth
//   reauthExpires — ISO date string of when the window closes
//
// Both fields are cleared the moment they expire or when the window is
// explicitly consumed by a sensitive action.

import { cookies } from 'next/headers';
import clientPromise from './mongodb';

/** How long a successful re-auth authorises sensitive actions (10 minutes). */
export const REAUTH_WINDOW_MS = 10 * 60 * 1000;

// ─── Internal helpers ────────────────────────────────────────────────────────

async function getDb() {
  const client = await clientPromise;
  return client.db('resources');
}

async function getSessionUser(db, projection = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  if (!token) return null;
  return db.collection('admin_users').findOne({ sessionToken: token }, { projection });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether the current session user has a valid re-auth window open.
 * Returns { user, db } if authorised; returns { error: Response } if not.
 */
export async function requireReauth(extraProjection = {}) {
  const db = await getDb();
  const user = await getSessionUser(db, {
    _id: 1,
    reauthAt: 1,
    reauthExpires: 1,
    ...extraProjection,
  });

  if (!user) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'No active session' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  const now = new Date();
  const expires = user.reauthExpires ? new Date(user.reauthExpires) : null;
  const valid = expires && expires > now;

  if (!valid) {
    return {
      error: new Response(
        JSON.stringify({
          error: 'ReauthRequired',
          message: 'This action requires recent authentication. Please confirm your identity.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { user, db };
}

/**
 * Grant a fresh re-auth window for the current session user.
 * Must only be called after the user's credential has been verified.
 */
export async function grantReauth(userId) {
  const db = await getDb();
  const now = new Date();
  const expires = new Date(now.getTime() + REAUTH_WINDOW_MS);
  await db.collection('admin_users').updateOne(
    { _id: userId },
    { $set: { reauthAt: now, reauthExpires: expires } }
  );
}

/**
 * Revoke re-auth (call after a sensitive action succeeds so the window is
 * single-use — the user must re-authenticate before the next sensitive action).
 */
export async function revokeReauth(userId) {
  const db = await getDb();
  await db.collection('admin_users').updateOne(
    { _id: userId },
    { $unset: { reauthAt: '', reauthExpires: '' } }
  );
}

/**
 * Low-level helper: resolve the current session user without the re-auth check.
 * Useful for the re-auth grant endpoints themselves.
 */
export async function getSessionUserForReauth(extraProjection = {}) {
  const db = await getDb();
  const user = await getSessionUser(db, {
    _id: 1,
    password: 1,
    webauthn: 1,
    ...extraProjection,
  });
  return { user, db };
}
