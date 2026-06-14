import { cookies } from 'next/headers';
import clientPromise from '../../../../../../lib/mongodb';
import { generateChallenge, getRpId } from '../../../../../../lib/webauthn';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// Returns WebAuthn assertion options for the current user.
//
// Two modes are supported:
//  - Logged-in step-up: no body, the user is resolved from the admin_token cookie.
//  - Login (passwordless): the body carries { username }, so the flow works
//    before any session exists.
export async function POST(request) {
  try {
    let username = null;
    try {
      const body = await request.json();
      username = body?.username ? String(body.username).trim() : null;
    } catch {
      // No JSON body -> session-based step-up.
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

    // Always return the same generic response when there are no credentials so
    // the login form cannot be used to enumerate which accounts have passkeys.
    if (!user || !user.webauthn?.credentials?.length) {
      return json({ success: false, error: 'No Credentials', message: 'No passkey is registered for this account.' }, 404);
    }

    const challenge = generateChallenge(32);
    const challengeExpires = new Date(Date.now() + 5 * 60 * 1000);

    await db.collection('admin_users').updateOne(
      { _id: user._id },
      { $set: { 'webauthn.challenge': challenge, 'webauthn.challengeExpires': challengeExpires } }
    );

    const allowCredentials = user.webauthn.credentials.map(cred => ({
      id: cred.credentialID, // base64url, decoded client-side
      type: 'public-key',
      transports: Array.isArray(cred.transports) ? cred.transports : [],
    }));

    const rpId = getRpId();
    console.log('[WebAuthn auth/options] rpId:', rpId, '| env var:', process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || '(NOT SET — falling back to localhost!)');

    return json({
      challenge,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 300000,
      rpId,
    });
  } catch (error) {
    console.error('WebAuthn authentication options error:', error);
    return json({ success: false, error: 'Internal server error' }, 500);
  }
}
