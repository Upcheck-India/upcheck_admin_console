import { cookies } from 'next/headers';
import clientPromise from '../../../../../../lib/mongodb';
import { generateChallenge, getRpId, getRpName } from '../../../../../../lib/webauthn';
import { requireReauth } from '../../../../../../lib/reauth';

// Helper: generate a secure base64url challenge (delegates to the shared helper).
function generateSecureRandomString() {
  return generateChallenge(32);
}

export async function POST(request) {
  console.log('Starting WebAuthn registration options request');
  try {
    const { user, db, error } = await requireReauth({ email: 1, name: 1, role: 1 });
    if (error) return error;

    console.log('Authenticated user for passkey registration:', user.email); 

    // Generate a secure random challenge
    const challengeBase64 = generateSecureRandomString();
    
    console.log('Generated challenge for user:', {
      userId: user._id,
      challenge: challengeBase64,
      length: challengeBase64.length,
      type: 'base64url'
    });
    
    // Store the challenge in the user's document
    const updateResult = await db.collection('admin_users').updateOne(
      { _id: user._id },
      { 
        $set: { 
          'webauthn.challenge': challengeBase64,
          'webauthn.challengeTimestamp': new Date()
        } 
      }
    );
    
    console.log('Challenge storage result:', {
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
      upsertedCount: updateResult.upsertedCount,
      upsertedId: updateResult.upsertedId
    });
    
    // Verify the challenge was stored
    const updatedUser = await db.collection('admin_users').findOne(
      { _id: user._id },
      { projection: { 'webauthn.challenge': 1 } }
    );
    
    console.log('Stored challenge verification:', {
      userId: user._id,
      storedChallenge: updatedUser?.webauthn?.challenge,
      matches: updatedUser?.webauthn?.challenge === challengeBase64,
      storedLength: updatedUser?.webauthn?.challenge?.length,
      expectedLength: challengeBase64.length
    });
    
    if (!updatedUser?.webauthn?.challenge) {
      throw new Error('Failed to store challenge in database');
    }

    // Set up RP ID and origin handling
    const rpId = getRpId();
    const rpName = getRpName();
    
    console.log('WebAuthn Registration Options:', {
      rpId,
      rpName,
      nodeEnv: process.env.NODE_ENV
    });
    
    const options = {
      challenge: challengeBase64, // Already in base64url format
      rp: {
        name: rpName,
        id: rpId,
      },
      user: {
        id: Buffer.from(user._id.toString()).toString('base64url'),
        name: user.email,
        displayName: user.name || user.email,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },  // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      timeout: 60000,
      attestation: 'none',
      authenticatorSelection: {
        // 'platform' = built-in biometrics (fingerprint / Face ID / Windows Hello)
        // 'cross-platform' = hardware security keys (YubiKey etc.)
        // Omitting authenticatorAttachment lets the user choose either.
        userVerification: 'required',
        requireResidentKey: true,
        residentKey: 'required',
      },
    };
    
    console.log('Registration options created successfully');
    
    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('WebAuthn registration options error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate registration options',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
