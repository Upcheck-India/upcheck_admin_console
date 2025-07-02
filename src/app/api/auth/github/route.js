import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req) {
  try {
    const { code, redirect_uri } = await req.json();
    
    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirect_uri || `${process.env.NEXTAUTH_URL}/console/profile`
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      throw new Error(tokenData.error_description || 'Failed to get access token from GitHub');
    }

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    const githubUser = await userResponse.json();

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info from GitHub');
    }

    // Get user email if not provided in the main user object
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `token ${tokenData.access_token}`,
          'Accept': 'application/json'
        }
      });
      
      if (emailsResponse.ok) {
        const emails = await emailsResponse.json();
        const primaryEmail = emails.find(e => e.primary && e.verified);
        if (primaryEmail) {
          email = primaryEmail.email;
        }
      }
    }

    const client = await clientPromise;
    const db = client.db("resources");
    
    // Get the current user's session
    const sessionToken = cookies().get('admin_token')?.value;
    if (!sessionToken) {
      throw new Error('No active session found');
    }

    // Find the current user
    const user = await db.collection('admin_users').findOne({ sessionToken });
    if (!user) {
      throw new Error('User not found');
    }

    // Update user with GitHub info
    const updateData = {
      'oauth.github': {
        id: githubUser.id,
        login: githubUser.login,
        email: email,
        name: githubUser.name || githubUser.login,
        avatar: githubUser.avatar_url,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : null
      },
      updatedAt: new Date()
    };

    await db.collection('admin_users').updateOne(
      { _id: user._id },
      { $set: updateData }
    );

    return NextResponse.json({ 
      success: true,
      message: 'GitHub account connected successfully',
      user: {
        id: githubUser.id,
        name: githubUser.name || githubUser.login,
        email: email,
        avatar: githubUser.avatar_url
      }
    });

  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect GitHub account' },
      { status: 500 }
    );
  }
}
