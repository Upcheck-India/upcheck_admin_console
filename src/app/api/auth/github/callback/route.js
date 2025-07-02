import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { randomBytes } from 'crypto';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('GitHub OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/console/profile?error=${encodeURIComponent(errorDescription || 'GitHub authentication failed')}`
      );
    }

    if (!code || !state) {
      throw new Error('Missing required OAuth parameters');
    }

    // Get the user's session
    const sessionToken = cookies().get('admin_token')?.value;
    if (!sessionToken) {
      throw new Error('No active session found');
    }

    const client = await clientPromise;
    const db = client.db("resources");
    
    // Verify the state parameter
    const user = await db.collection('admin_users').findOne({ 
      sessionToken,
      oauthState: state,
      oauthStateExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      throw new Error('Invalid or expired OAuth state');
    }

    // Exchange the authorization code for an access token
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
        state
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
      { 
        $set: updateData,
        $unset: { oauthState: '', oauthStateExpiresAt: '' } // Clean up
      }
    );

    // Redirect back to the profile page with success message
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/console/profile?success=github_connected`
    );

  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/console/profile?error=${encodeURIComponent(error.message || 'GitHub authentication failed')}`
    );
  }
}
