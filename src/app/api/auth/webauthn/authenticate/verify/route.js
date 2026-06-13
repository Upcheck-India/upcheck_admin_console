import { cookies } from 'next/headers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import clientPromise from '../../../../../../lib/mongodb';
import { getRpId, getExpectedOrigins, toBuffer } from '../../../../../../lib/webauthn';
import { issueAdminSessionToken, setAdminSessionCookie } from '../../../../../../lib/adminSession';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// Verifies a WebAuthn assertion and, on success, establishes an admin session.
//
//  - Login (passwordless): body carries { credential, username }.
//  - Logged-in step-up: body carries { credential }; user resolved from cookie.
export async function POST(request) {
  try {
    const { credential, username } = await request.json();

    if (!credential?.id || !credential?.response) {
      return json({ success: false, error: 'Invalid Request', message: 'Missing credential data' }, 400);
    }

    const client = await clientPromise;
    const db = client.db('resources');

    let user = null;
    if (username) {
      user = await db.collection('admin_users').findOne(
        { username: String(username).trim() },
        { projection: { webauthn: 1, email: 1, name: 1, role: 1, username: 1 } }
      );
    } else {
      const cookieStore = await cookies();
      const token = cookieStore.get('admin_token')?.value;
      if (!token) {
        return json({ success: false, error: 'Unauthorized', message: 'No authentication token found' }, 401);
      }
      user = await db.collection('admin_users').findOne(
        { sessionToken: token },
        { projection: { webauthn: 1, email: 1, name: 1, role: 1, username: 1 } }
      );
    }

    if (!user || !user.webauthn?.credentials?.length) {
      return json({ success: false, error: 'No Credentials', message: 'No passkey is registered for this account.' }, 400);
    }

    const expectedChallenge = user.webauthn?.challenge;
    const challengeExpires = user.webauthn?.challengeExpires;

    if (!expectedChallenge) {
      return json({ success: false, error: 'No Challenge', message: 'No authentication challenge found. Please try again.' }, 400);
    }

    if (challengeExpires && new Date(challengeExpires) < new Date()) {
      return json({ success: false, error: 'Challenge Expired', message: 'Authentication challenge has expired. Please try again.' }, 400);
    }

    // Match the authenticator by its base64url credential id (id or rawId).
    const authenticator = user.webauthn.credentials.find(
      cred => cred.credentialID === credential.id || cred.credentialID === credential.rawId
    );

    if (!authenticator) {
      return json({ success: false, error: 'Invalid Credential', message: 'The provided credential is not registered to this account' }, 400);
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: {
          id: credential.id,
          rawId: credential.rawId || credential.id,
          type: credential.type || 'public-key',
          response: {
            authenticatorData: credential.response.authenticatorData,
            clientDataJSON: credential.response.clientDataJSON,
            signature: credential.response.signature,
            userHandle: credential.response.userHandle,
          },
          clientExtensionResults: credential.clientExtensionResults || {},
        },
        expectedChallenge,
        expectedOrigin: getExpectedOrigins(request),
        expectedRPID: getRpId(),
        authenticator: {
          credentialID: toBuffer(authenticator.credentialID),
          credentialPublicKey: toBuffer(authenticator.credentialPublicKey),
          counter: authenticator.counter || 0,
          transports: Array.isArray(authenticator.transports) ? authenticator.transports : [],
        },
        requireUserVerification: false,
      });
    } catch (error) {
      console.error('Error during WebAuthn verification:', error);
      return json({ success: false, error: 'Verification Error', message: error.message || 'An error occurred during verification' }, 400);
    }

    if (!verification.verified) {
      return json({ success: false, error: 'Verification Failed', message: 'Authentication verification failed' }, 400);
    }

    // Update counter / lastUsed and clear the consumed challenge.
    const now = new Date();
    await db.collection('admin_users').updateOne(
      { _id: user._id, 'webauthn.credentials.credentialID': authenticator.credentialID },
      {
        $set: {
          'webauthn.credentials.$.counter': verification.authenticationInfo.newCounter,
          'webauthn.credentials.$.lastUsed': now,
          updatedAt: now,
        },
        $unset: { 'webauthn.challenge': '', 'webauthn.challengeExpires': '' },
      }
    );

    // Establish the same admin session a password login would create.
    const sessionToken = await issueAdminSessionToken(db, user._id);
    await setAdminSessionCookie(sessionToken);

    console.log(`Successfully authenticated user ${user.email} with WebAuthn`);

    return json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('WebAuthn authentication verification error:', error);
    return json({ success: false, error: 'Internal server error' }, 500);
  }
}
