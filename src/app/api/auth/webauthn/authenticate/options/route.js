import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper function to generate a secure random string
function generateSecureRandomString(length = 32) {
  return randomBytes(length).toString('base64url');
}

export async function POST() {
  try {
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
      { 
        projection: { 
          'webauthn.credentials': 1,
          email: 1,
          _id: 1
        } 
      }
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

    // Generate a secure random challenge
    const challenge = generateSecureRandomString(32);
    
    // Store challenge in user's document with expiration (5 minutes)
    const challengeExpires = new Date(Date.now() + 5 * 60 * 1000);
    
    await db.collection('admin_users').updateOne(
      { _id: user._id },
      { 
        $set: { 
          'webauthn.challenge': challenge,
          'webauthn.challengeExpires': challengeExpires
        } 
      }
    );

    console.log(`Generated authentication challenge for user ${user.email}`);

    // Get allowed credentials
    const allowCredentials = user.webauthn.credentials.map(cred => {
      // Convert credential ID from base64url to Uint8Array
      const credentialId = cred.credentialID;
      
      return {
        id: credentialId,
        type: 'public-key',
        transports: Array.isArray(cred.transports) ? cred.transports : [],
      };
    });

    // Create authentication options
    const options = {
      challenge: challenge,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 300000, // 5 minutes
      rpId: process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost',
    };

    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('WebAuthn authentication options error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
