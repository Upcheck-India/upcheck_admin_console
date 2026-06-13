import { cookies } from 'next/headers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { toBase64Url } from '../../../../../../lib/webauthn';

export async function POST(request) {
  try {
    // Get the token from cookies - must be awaited
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    
    if (!token) {
      console.error('No admin_token found in cookies');
      return new Response(JSON.stringify({ error: 'Unauthorized - No token' }), { 
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
          role: 1,
          webauthn: 1
        } 
      }
    );
    
    if (!user) {
      console.error('No user found with the provided session token');
      return new Response(JSON.stringify({ 
        error: 'Unauthorized - Invalid session' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await request.json();
    console.log('Received verification request data:', JSON.stringify(data, null, 2));
    
    if (!data.credential) {
      console.error('No credential provided in request');
      return new Response(JSON.stringify({ 
        error: 'No credential provided' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { credential } = data;

    // User is already fetched above

    // Get the stored challenge with timestamp
    let challengeData = user.webauthn?.challenge;
    const challengeTimestamp = user.webauthn?.challengeTimestamp;
    
    // If challenge is base64url encoded, decode it back to the original format
    if (challengeData && /^[A-Za-z0-9_-]+$/.test(challengeData)) {
      try {
        // The challenge is stored in base64url format, but we need the original string
        // Since the client will send the challenge back in the same format, we can use it as-is
        console.log('Challenge is base64url encoded, using as-is');
      } catch (e) {
        console.error('Failed to decode base64url challenge:', e);
      }
    }
    
    console.log('Retrieved challenge data from DB:', {
      challengeData,
      challengeTimestamp,
      challengeType: typeof challengeData,
      challengeLength: challengeData?.length,
      isBase64: challengeData ? /^[A-Za-z0-9_-]+$/.test(challengeData) : false,
      challengeValue: challengeData
    });
    
    if (!challengeData || !challengeTimestamp) {
      console.error('No active registration challenge found for user:', user._id);
      return new Response(JSON.stringify({ 
        error: 'No active registration session',
        details: 'Please start a new registration process'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if challenge is expired (5 minutes)
    const challengeAge = Date.now() - new Date(challengeTimestamp).getTime();
    const CHALLENGE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    
    if (challengeAge > CHALLENGE_TIMEOUT) {
      console.error('Registration challenge expired for user:', user._id, 'Age:', challengeAge);
      // Clear expired challenge
      await db.collection('admin_users').updateOne(
        { _id: user._id },
        { $unset: { 'webauthn.challenge': '', 'webauthn.challengeTimestamp': '' } }
      );
      
      return new Response(JSON.stringify({ 
        error: 'Registration session expired',
        details: 'Please start a new registration process'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Found expected challenge for user:', user._id);

    // Get the expected origin and RP ID
    const isProduction = process.env.NODE_ENV === 'production';
    const expectedRPID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost';
    let expectedOrigin = process.env.NEXTAUTH_URL || 
                        (isProduction 
                          ? `https://${expectedRPID}` 
                          : 'http://localhost:3000');
    
    // For local development, allow both http and https origins
    if (!isProduction) {
      expectedOrigin = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://localhost:3000',
        'https://127.0.0.1:3000'
      ];
    }
    
    console.log('Verifying registration with:', {
      expectedOrigin,
      expectedRPID,
      hasCredential: !!credential,
      hasChallenge: !!challengeData?.challenge,
      challengeData
    });
    
    // Process the credential data
    const credentialForVerification = {
      id: credential.id,
      rawId: credential.rawId || credential.id,
      type: credential.type,
      response: {
        clientDataJSON: credential.response.clientDataJSON,
        attestationObject: credential.response.attestationObject,
        transports: credential.response.transports || [],
        // Ensure we don't send any unexpected fields
      },
      clientExtensionResults: credential.clientExtensionResults || {},
      authenticatorAttachment: credential.authenticatorAttachment
    };
    
    // Debug: Log the challenge we're expecting
    console.log('Expected challenge from server:', {
      challenge: challengeData,
      type: typeof challengeData,
      length: challengeData?.length,
      first10: typeof challengeData === 'string' ? challengeData.substring(0, 10) : 'N/A'
    });
    
    // Debug: Parse clientDataJSON to see what challenge was actually used
    try {
      const clientData = JSON.parse(Buffer.from(credential.response.clientDataJSON, 'base64').toString('utf-8'));
      console.log('Client data:', {
        type: clientData.type,
        challenge: clientData.challenge,
        origin: clientData.origin,
        crossOrigin: clientData.crossOrigin
      });
    } catch (e) {
      console.error('Failed to parse clientDataJSON:', e);
    }

    console.log('Processing credential with ID:', credential.id);
    console.log('Credential rawId:', credential.rawId || credential.id);
    console.log('Client data JSON:', credential.response.clientDataJSON);

    // Verify the registration
    let verification;
    try {
      console.log('Starting verification with:', {
        expectedRPID,
        expectedOrigin,
        challengeLength: challengeData?.length,
        hasCredential: !!credentialForVerification,
        hasAttestation: !!credentialForVerification.response.attestationObject
      });
      
      // Get the challenge from challengeData
      const expectedChallenge = challengeData;
      
      // Parse clientDataJSON to get the challenge sent by the client
    let clientData;
    try {
      clientData = JSON.parse(Buffer.from(credentialForVerification.response.clientDataJSON, 'base64').toString('utf-8'));
      console.log('Client data from registration:', {
        challenge: clientData.challenge,
        challengeLength: clientData.challenge?.length,
        type: clientData.type,
        origin: clientData.origin
      });
      
      // Verify the challenge matches what we stored
      if (clientData.challenge !== expectedChallenge) {
        console.error('Challenge mismatch!', {
          expected: expectedChallenge,
          received: clientData.challenge,
          match: clientData.challenge === expectedChallenge
        });
        throw new Error('Challenge verification failed: challenges do not match');
      }
      
      // In development, check if the origin is in the allowed list
      if (!isProduction && Array.isArray(expectedOrigin)) {
        if (!expectedOrigin.includes(clientData.origin)) {
          console.error('Origin not in allowed list:', {
            received: clientData.origin,
            allowed: expectedOrigin
          });
          throw new Error(`Invalid origin: ${clientData.origin}`);
        }
        // Use the first origin from the allowed list for verification
        expectedOrigin = expectedOrigin[0];
      }  
    } catch (e) {
      console.error('Failed to parse clientDataJSON:', e);
      throw new Error('Invalid client data: ' + e.message);
    }
      
      // Perform the verification
      verification = await verifyRegistrationResponse({
        response: credentialForVerification,
        expectedChallenge: expectedChallenge,
        expectedOrigin: expectedOrigin,
        expectedRPID: expectedRPID,
        requireUserVerification: true,
      });
      
      console.log('Verification successful:', {
        verified: verification.verified,
        registrationInfo: verification.registrationInfo ? {
          credentialID: verification.registrationInfo.credentialID ? 
            Buffer.from(verification.registrationInfo.credentialID).toString('base64').substring(0, 20) + '...' : null,
          credentialPublicKey: verification.registrationInfo.credentialPublicKey ? 
            '...' + verification.registrationInfo.credentialPublicKey.byteLength + ' bytes' : null,
        } : null
      });
      
      console.log('Verification result:', JSON.stringify({
        verified: verification.verified,
        registrationInfo: verification.registrationInfo ? 'present' : 'missing'
      }, null, 2));
    } catch (verifyError) {
      console.error('Error during verification:', verifyError);
      return new Response(JSON.stringify({ 
        error: 'Verification failed',
        details: verifyError.message
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { verified, registrationInfo } = verification;

    if (!verified || !registrationInfo) {
      console.error('Verification failed:', { verified, hasRegistrationInfo: !!registrationInfo });
      return new Response(JSON.stringify({ 
        error: 'Verification failed',
        details: 'The provided credentials could not be verified'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      // Store the new credential. Identifiers and the public key are persisted
      // as base64url strings so the authentication route can look them up and
      // decode them with the exact same encoding.
      const newDevice = {
        credentialID: toBase64Url(registrationInfo.credentialID),
        credentialPublicKey: toBase64Url(registrationInfo.credentialPublicKey),
        counter: registrationInfo.counter ?? 0,
        transports: credential.response.transports || [],
        addedAt: new Date(),
        lastUsed: new Date(),
        deviceName: data.deviceName || 'Biometric Device',
        deviceType: data.deviceType || 'biometric',
      };

      // Guard against registering the same authenticator twice.
      const alreadyRegistered = (user.webauthn?.credentials || []).some(
        cred => cred.credentialID === newDevice.credentialID
      );
      if (alreadyRegistered) {
        await db.collection('admin_users').updateOne(
          { _id: user._id },
          { $unset: { 'webauthn.challenge': '', 'webauthn.challengeTimestamp': '' } }
        );
        return new Response(JSON.stringify({
          error: 'Already registered',
          message: 'This device is already registered for biometric sign-in.'
        }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      }

      console.log('Storing new device for user:', user._id);
      
      // Update user with new credential
      const updateResult = await db.collection('admin_users').updateOne(
        { _id: user._id },
        {
          $push: { 'webauthn.credentials': newDevice },
          $unset: { 'webauthn.challenge': '', 'webauthn.challengeTimestamp': '' }
        }
      );
      
      console.log('Update result:', JSON.stringify(updateResult, null, 2));

      return new Response(JSON.stringify({ 
        verified: true,
        deviceName: newDevice.deviceName
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        },
      });
    } catch (dbError) {
      console.error('Database error during device storage:', dbError);
      return new Response(JSON.stringify({ 
        error: 'Failed to store device',
        details: 'Could not save the biometric device information'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('WebAuthn registration verification error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      cause: error.cause
    });
    
    // Check for specific error types
    let errorDetails = {};
    if (error.name === 'Error' && error.message.includes('Unexpected registration response challenge')) {
      errorDetails = {
        type: 'challenge_mismatch',
        expected: error.message.match(/expected "([^"]+)"/)?.[1],
        received: error.message.match(/got "([^"]+)"/)?.[1],
        message: 'The registration challenge does not match. Please try the registration process again.'
      };
    } else if (error.name === 'TypeError') {
      errorDetails = {
        type: 'invalid_data',
        message: 'Invalid data format received. Please ensure your browser supports WebAuthn and try again.'
      };
    } else {
      errorDetails = {
        type: 'server_error',
        message: 'An unexpected error occurred during verification.'
      };
      
      // Include more details in development
      if (process.env.NODE_ENV === 'development') {
        errorDetails.debug = {
          message: error.message,
          stack: error.stack,
          name: error.name,
          code: error.code
        };
      }
    }
    
    return new Response(JSON.stringify({ 
      error: 'Verification failed',
      ...errorDetails
    }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
}
