import { cookies } from 'next/headers';
import clientPromise from '../../../../../../lib/mongodb';
import { generateChallenge, getRpId } from '../../../../../../lib/webauthn';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// Returns WebAuthn assertion options.
//
// Two modes:
//  - Login (passwordless): body carries { username } — challenge stored per-user.
//  - Logged-in step-up: no body — challenge stored on the session user.
//
// We always return an EMPTY allowCredentials list (discoverable credential flow).
// This lets the browser show ALL passkeys stored for the RP domain rather than
// filtering by specific credential IDs. Filtering by ID is the root cause of
// NotAllowedError when the passkey lives in a different browser's credential
// store (e.g., Chrome GPM vs Edge / Windows Hello).
export async function POST(request) {
  try {
    let username = null;
    try {
      const body = await request.json();
      username = body?.username ? String(body.username).trim() : null;
    } catch {
      // No JSON body → session-based step-up.
    }

    const client = await clientPromise;
    const db = client.db('resources');

    let user = null;
    if (username) {
      user = await db.collection('admin_users').findOne(
        { username },
        { projection: { 'webauthn.credentials': 1, email: 1, _id: 1 } }
      );
    } else {
      const cookieStore = await cookies();
      const token = cookieStore.get('admin_token')?.value;
      if (!token) {
        return json({ success: false, error: 'Unauthorized', message: 'No authentication token found' }, 401);
      }
      user = await db.collection('admin_users').findOne(
        { sessionToken: token },
        { projection: { 'webauthn.credentials': 1, email: 1, _id: 1 } }
      );
    }

    // Return same generic error for missing user/no credentials so that the
    // login form cannot enumerate which accounts have passkeys registered.
    if (!user || !user.webauthn?.credentials?.length) {
      return json({ success: false, error: 'No Credentials', message: 'No passkey is registered for this account.' }, 404);
    }

    const challenge = generateChallenge(32);
    const challengeExpires = new Date(Date.now() + 5 * 60 * 1000); // 5-min server window

    await db.collection('admin_users').updateOne(
      { _id: user._id },
      { $set: { 'webauthn.challenge': challenge, 'webauthn.challengeExpires': challengeExpires } }
    );

    const rpId = getRpId();
    console.log('[WebAuthn auth/options] rpId:', rpId, '| env var:', process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || '(NOT SET — falling back to localhost!)');

    // Empty allowCredentials = discoverable credential flow.
    // The browser shows ALL passkeys it has for the RP domain from its own
    // credential store (Windows Hello, iCloud Keychain, Google Password Manager,
    // etc.) rather than searching for specific credential IDs that may live in a
    // different browser's store.
    return json({
      challenge,
      allowCredentials: [],
      userVerification: 'preferred',
      timeout: 90000, // 90 seconds — long enough to act, short enough to feel snappy
      rpId,
    });
  } catch (error) {
    console.error('WebAuthn authentication options error:', error);
    return json({ success: false, error: 'Internal server error' }, 500);
  }
}
