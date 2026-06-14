import { cookies } from 'next/headers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import clientPromise from '../../../../../../lib/mongodb';
import { getRpId, getExpectedOrigins, toBase64Url } from '../../../../../../lib/webauthn';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return json({ error: 'Unauthorized', message: 'No authentication token found' }, 401);
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, name: 1, webauthn: 1 } }
    );

    if (!user) {
      return json({ error: 'Unauthorized', message: 'Invalid or expired session' }, 401);
    }

    const body = await request.json();
    const { credential, deviceName, deviceType } = body;

    if (!credential) {
      return json({ error: 'No credential provided' }, 400);
    }

    // Validate the stored challenge -------------------------------------------
    const expectedChallenge = user.webauthn?.challenge;
    const challengeTimestamp = user.webauthn?.challengeTimestamp;

    if (!expectedChallenge || !challengeTimestamp) {
      return json({
        error: 'No active registration session',
        message: 'Please start a new registration process',
      }, 400);
    }

    const CHALLENGE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    if (Date.now() - new Date(challengeTimestamp).getTime() > CHALLENGE_TIMEOUT_MS) {
      await db.collection('admin_users').updateOne(
        { _id: user._id },
        { $unset: { 'webauthn.challenge': '', 'webauthn.challengeTimestamp': '' } }
      );
      return json({
        error: 'Registration session expired',
        message: 'Please start a new registration process',
      }, 400);
    }

    // Derive RP config from the shared helpers — same values the browser used -
    const expectedRPID = getRpId();
    const expectedOrigin = getExpectedOrigins(request);

    console.log('Verifying registration:', {
      expectedRPID,
      expectedOrigin,
      userId: user._id,
    });

    // Let @simplewebauthn/server verify everything (challenge, origin, RP ID,
    // attestation) in one step — it is the authoritative source of truth here.
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: {
          id: credential.id,
          rawId: credential.rawId || credential.id,
          type: credential.type || 'public-key',
          response: {
            clientDataJSON: credential.response.clientDataJSON,
            attestationObject: credential.response.attestationObject,
            transports: credential.response.transports || [],
          },
          clientExtensionResults: credential.clientExtensionResults || {},
          authenticatorAttachment: credential.authenticatorAttachment,
        },
        expectedChallenge,
        expectedOrigin,
        expectedRPID,
        requireUserVerification: true,
      });
    } catch (err) {
      console.error('Registration verification error:', err.message);
      return json({ error: 'Verification failed', message: err.message }, 400);
    }

    if (!verification.verified || !verification.registrationInfo) {
      return json({ error: 'Verification failed', message: 'The credential could not be verified' }, 400);
    }

    const { registrationInfo } = verification;

    // Store the credential — all binary values as base64url strings -----------
    const newDevice = {
      credentialID: toBase64Url(registrationInfo.credential?.id ?? registrationInfo.credentialID),
      credentialPublicKey: toBase64Url(registrationInfo.credential?.publicKey ?? registrationInfo.credentialPublicKey),
      counter: registrationInfo.credential?.counter ?? registrationInfo.counter ?? 0,
      transports: credential.response.transports || [],
      addedAt: new Date(),
      lastUsed: new Date(),
      deviceName: deviceName || 'Passkey',
      deviceType: deviceType || 'passkey',
    };

    // Guard against duplicate registration
    const alreadyRegistered = (user.webauthn?.credentials || []).some(
      c => c.credentialID === newDevice.credentialID
    );
    if (alreadyRegistered) {
      await db.collection('admin_users').updateOne(
        { _id: user._id },
        { $unset: { 'webauthn.challenge': '', 'webauthn.challengeTimestamp': '' } }
      );
      return json({ error: 'Already registered', message: 'This authenticator is already registered.' }, 409);
    }

    await db.collection('admin_users').updateOne(
      { _id: user._id },
      {
        $push: { 'webauthn.credentials': newDevice },
        $unset: { 'webauthn.challenge': '', 'webauthn.challengeTimestamp': '' },
      }
    );

    console.log(`Registered passkey for ${user.email}: ${newDevice.credentialID.substring(0, 16)}…`);

    return json({ verified: true, deviceName: newDevice.deviceName });
  } catch (error) {
    console.error('WebAuthn register/verify unexpected error:', error);
    return json({ error: 'Internal server error', message: error.message }, 500);
  }
}
