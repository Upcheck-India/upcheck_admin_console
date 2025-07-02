import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';

export async function GET() {
  try {
    // Get the current user's session
    const sessionToken = cookies().get('admin_token')?.value;
    if (!sessionToken) {
      return new Response(JSON.stringify({ 
        connectedAccounts: [] 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    
    // Find the current user
    const user = await db.collection('admin_users').findOne({ 
      sessionToken 
    });

    if (!user) {
      return new Response(JSON.stringify({ 
        connectedAccounts: [] 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check which OAuth providers are connected
    const connectedAccounts = [];
    if (user.oauth?.github) {
      connectedAccounts.push('github');
    }
    if (user.oauth?.google) {
      connectedAccounts.push('google');
    }
    if (user.oauth?.vercel) {
      connectedAccounts.push('vercel');
    }
    if (user.oauth?.reddit) {
      connectedAccounts.push('reddit');
    }

    return new Response(JSON.stringify({ 
      connectedAccounts 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching connected accounts:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch connected accounts',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
