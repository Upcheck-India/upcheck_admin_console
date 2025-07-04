import { cookies } from 'next/headers';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function DELETE(request, { params }) {
  try {
    // Get the credential ID from the URL
    const { credentials: credentialId } = params;
    
    if (!credentialId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Missing credential ID' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

    // Connect to database
    const client = await clientPromise;
    const db = client.db('resources');
    
    // Find user with active session and remove the credential
    const result = await db.collection('admin_users').updateOne(
      { 
        sessionToken: token,
        'webauthn.credentials.credentialID': credentialId 
      },
      { 
        $pull: { 
          'webauthn.credentials': { credentialID: credentialId } 
        } 
      }
    );

    if (result.matchedCount === 0) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Not Found',
        message: 'Device not found or you do not have permission to remove it'
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Removed WebAuthn device: ${credentialId}`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Device removed successfully',
      removed: result.modifiedCount > 0
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error removing WebAuthn device:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Internal Server Error',
      message: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET() {
  try {
    // Get the token from cookies
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
          'webauthn.credentials': 1,
          _id: 1,
          email: 1
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

    // Get the user's WebAuthn credentials or default to empty array
    const credentials = user.webauthn?.credentials || [];
    
    console.log(`Fetched ${credentials.length} WebAuthn devices for user:`, user.email);
    
    // Return the user's WebAuthn credentials in the expected format
    return new Response(JSON.stringify({
      success: true,
      devices: credentials.map(cred => ({
        id: cred.credentialID,
        credentialID: cred.credentialID,
        deviceName: cred.deviceName || 'Biometric Device',
        deviceType: cred.deviceType || 'biometric',
        addedAt: cred.addedAt || new Date().toISOString(),
        lastUsed: cred.lastUsed || null,
        transports: cred.transports || []
      }))
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching WebAuthn devices:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}