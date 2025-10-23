// app/api/auth/google/check-scopes/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../../lib/mongodb';
import { google } from 'googleapis';

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user._id.toString();
    const oauth = await db.collection('mail_oauth').findOne({ userId, provider: 'google' });
    
    if (!oauth) {
      return NextResponse.json({ connected: false, message: 'Not connected to Google' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    
    oauth2Client.setCredentials({
      access_token: oauth.tokens.access_token,
      refresh_token: oauth.tokens.refresh_token,
    });

    // Get token info from Google
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(oauth.tokens.access_token);
      
      const requiredScopes = [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
      ];

      const hasAllScopes = requiredScopes.every(scope => 
        tokenInfo.scopes?.includes(scope)
      );

      return NextResponse.json({
        connected: true,
        email: oauth.email,
        scopes: tokenInfo.scopes,
        hasRequiredScopes: hasAllScopes,
        missingScopes: requiredScopes.filter(s => !tokenInfo.scopes?.includes(s)),
        expiryDate: new Date(tokenInfo.expiry_date),
        storedScopes: oauth.tokens.scope
      });
    } catch (error) {
      return NextResponse.json({
        connected: true,
        email: oauth.email,
        error: 'Could not verify token',
        errorDetails: error.message,
        storedScopes: oauth.tokens.scope,
        needsReauth: true
      });
    }
  } catch (error) {
    console.error('Check scopes error:', error);
    return NextResponse.json({ error: 'Failed to check scopes' }, { status: 500 });
  }
}