import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { randomBytes } from 'crypto';

export async function POST(req) {
  try {
    const { redirect } = await req.json();
    
    // Generate a random state parameter for CSRF protection
    const state = randomBytes(16).toString('hex');
    
    // Store the state in the user's session
    const sessionToken = cookies().get('admin_token')?.value;
    if (!sessionToken) {
      throw new Error('No active session found');
    }

    const client = await clientPromise;
    const db = client.db("resources");
    
    // Update user with the OAuth state
    await db.collection('admin_users').updateOne(
      { sessionToken },
      { 
        $set: { 
          'oauthState': state,
          'oauthStateExpiresAt': new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        } 
      }
    );

    // Construct the GitHub OAuth URL
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: `${process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'}/api/auth/github/callback`,
      state,
      scope: 'user:email,repo',
      allow_signup: 'true'
    });

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

    return NextResponse.json({ 
      redirect: authUrl 
    });

  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate GitHub OAuth' },
      { status: 500 }
    );
  }
}
