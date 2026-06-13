// Shared helper for issuing an internal admin session.
//
// The console authenticates internal users with an httpOnly `admin_token`
// cookie whose value is a random session token also stored on the user's
// `admin_users` document (see src/app/api/auth/route.js). Passwordless flows
// (passkey / backup code login) must create exactly the same kind of session so
// the rest of the app continues to work unchanged.

import crypto from 'crypto';
import { cookies } from 'next/headers';

export const ADMIN_SESSION_MAX_AGE = 7200; // seconds (2 hours) - matches password login

// Persist a fresh session token on the user document and return it.
export async function issueAdminSessionToken(db, userId) {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  await db.collection('admin_users').updateOne(
    { _id: userId },
    { $set: { sessionToken, lastLogin: new Date() } }
  );
  return sessionToken;
}

// Write the admin_token cookie for the current response.
export async function setAdminSessionCookie(sessionToken) {
  const cookieStore = await cookies();
  cookieStore.set('admin_token', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: '/',
  });
}
