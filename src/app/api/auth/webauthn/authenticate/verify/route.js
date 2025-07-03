import { cookies } from 'next/headers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    const { credential } = await request.json();
    
    // Get the token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    
    if (!token) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Unauthorized',
        message: 'No authentication token found' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get database connection
    const client = await clientPromise;
    const db = client.db('resources');

    // Find user by session token
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { webauthn: 1, email: 1 } }
    );
    
    if (!user) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Not Found',
        message: 'User not found' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user has WebAuthn credentials
    if (!user.webauthn?.credentials?.length) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No Credentials',
        message: 'No WebAuthn credentials found for this account' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the stored challenge
    const expectedChallenge = user.webauthn?.challenge;
    const challengeExpires = user.webauthn?.challengeExpires;
    
    if (!expectedChallenge) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No Challenge',
        message: 'No authentication challenge found. Please try again.' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (challengeExpires && new Date(challengeExpires) < new Date()) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Challenge Expired',
        message: 'Authentication challenge has expired. Please try again.' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find the authenticator that was used
    const authenticator = user.webauthn.credentials.find(
      cred => cred.credentialID === credential.rawId
    );
    
    if (!authenticator) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Invalid Credential',
        message: 'The provided credential is not registered to this account' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify the authentication response
    try {
      const verification = await verifyAuthenticationResponse({
        response: {
          id: credential.id,
          rawId: credential.rawId,
          type: 'public-key',
          response: {
            authenticatorData: credential.response.authenticatorData,
            clientDataJSON: credential.response.clientDataJSON,
            signature: credential.response.signature,
            userHandle: credential.response.userHandle,
          },
          clientExtensionResults: {},
        },
        expectedChallenge: expectedChallenge,
        expectedOrigin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
        expectedRPID: process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost',
        authenticator: {
          credentialID: Buffer.from(authenticator.credentialID, 'base64url'),
          credentialPublicKey: Buffer.from(authenticator.credentialPublicKey, 'base64'),
          counter: authenticator.counter || 0,
          transports: Array.isArray(authenticator.transports) ? authenticator.transports : [],
        },
        requireUserVerification: true,
      });

      if (!verification.verified) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Verification Failed',
          message: 'Authentication verification failed' 
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Update the authenticator's counter and last used timestamp in the database
      const now = new Date();
      await db.collection('admin_users').updateOne(
        { 
          _id: user._id, 
          'webauthn.credentials.credentialID': authenticator.credentialID 
        },
        { 
          $set: { 
            'webauthn.credentials.$.counter': verification.authenticationInfo.newCounter,
            'webauthn.credentials.$.lastUsed': now,
            'webauthn.challenge': null,
            'webauthn.challengeExpires': null,
            updatedAt: now
          }
        }
      );

      console.log(`Successfully authenticated user ${user.email} with WebAuthn`);
      
      // Create session
      const sessionToken = await createSession({
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      });

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Authentication successful',
        user: {
          id: user._id,
          email: user.email,
          name: user.name
        }
      }), {
        status: 200,
        headers: {
          'Set-Cookie': `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error during WebAuthn verification:', error);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Verification Error',
        message: error.message || 'An error occurred during verification' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('WebAuthn authentication verification error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
