import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import clientPromise from '../../../../../../lib/mongodb';

// Helper function to generate a secure random string
function generateSecureRandomString(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64url');
}

export async function POST(request) {
  console.log('Starting WebAuthn registration options request');
  try {
    // Get the token from cookies - must be awaited
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    
    if (!token) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        message: 'No authentication token found' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db('resources');
    
    // Find user with active session
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { 
        projection: { 
          _id: 1,
          email: 1,
          name: 1,
          role: 1
        } 
      }
    );
    
    if (!user) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        message: 'Invalid or expired session' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Authenticated user:', user.email); 

    // Generate a secure random challenge
    const challengeBase64 = generateSecureRandomString(32);
    
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
    const isProduction = process.env.NODE_ENV === 'production';
    const rpId = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost';
    
    // For local development, allow both http and https origins
    let origin;
    if (isProduction) {
      origin = process.env.NEXTAUTH_URL || `https://${rpId}`;
    } else {
      // In development, use the request origin
      const requestOrigin = request.headers.get('origin') || 'http://localhost:3000';
      origin = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://localhost:3000',
        'https://127.0.0.1:3000'
      ].includes(requestOrigin) ? requestOrigin : 'http://localhost:3000';
    }
    
    console.log('WebAuthn Registration Options:', {
      rpId,
      origin,
      isProduction,
      nodeEnv: process.env.NODE_ENV
    });
    
    const options = {
      challenge: challengeBase64, // Already in base64url format
      rp: {
        name: 'Upcheck Admin',
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
      attestation: 'direct',
      authenticatorSelection: {
        userVerification: 'required',
        requireResidentKey: true,
        residentKey: 'required',
        authenticatorAttachment: 'platform',
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
