// POST /api/auth/reauth/passkey
// Verifies a WebAuthn assertion for the currently logged-in user and, on
// success, stamps a 10-minute re-auth window on their account.
//
// This is intentionally separate from the login passkey flow: it does NOT
// create a new session – it only elevates an existing one.

import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getRpId, getExpectedOrigins, toBuffer } from '../../../../../lib/webauthn';
import { grantReauth, getSessionUserForReauth } from '../../../../../lib/reauth';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function POST(request) {
  try {
    const { credential } = await request.json();

    if (!credential?.id || !credential?.response) {
      return json({ success: false, error: 'Invalid credential data' }, 400);
    }

    const { user } = await getSessionUserForReauth();

    if (!user) {
      return json({ success: false, error: 'Unauthorized', message: 'No active session' }, 401);
    }

    if (!user.webauthn?.credentials?.length) {
      return json({ success: false, error: 'No passkey registered for this account' }, 400);
    }

    // The challenge was stored during the options request (step-up mode uses
    // the existing authenticate/options endpoint without a username body).
    const expectedChallenge = user.webauthn?.challenge;
    const challengeExpires = user.webauthn?.challengeExpires;

    if (!expectedChallenge) {
      return json({
        success: false,
        error: 'No Challenge',
        message: 'Start the passkey flow first to receive a challenge.',
      }, 400);
    }

    if (challengeExpires && new Date(challengeExpires) < new Date()) {
      return json({ success: false, error: 'Challenge Expired', message: 'Please try again.' }, 400);
    }

    // Find the authenticator matching the returned credential ID.
    const authenticator = user.webauthn.credentials.find(
      c => c.credentialID === credential.id || c.credentialID === credential.rawId
    );

    if (!authenticator) {
      return json({
        success: false,
        error: 'Unknown Credential',
        message: 'The passkey used is not registered to this account.',
      }, 400);
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
    } catch (err) {
      console.error('Passkey reauth verification error:', err);
      return json({ success: false, error: 'Verification failed', message: err.message }, 400);
    }

    if (!verification.verified) {
      return json({ success: false, error: 'Verification failed' }, 400);
    }

    // Grant the elevated window — don't touch the session.
    await grantReauth(user._id);

    return json({ success: true, message: 'Re-authentication successful', expiresInSeconds: 600 });
  } catch (error) {
    console.error('Passkey reauth error:', error);
    return json({ success: false, error: 'Internal server error' }, 500);
  }
}
