// app/api/auth/google/test-gmail/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
import { google } from 'googleapis';

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = user._id.toString();
    const oauth = await db.collection('mail_oauth').findOne({ userId, provider: 'google' });
    if (!oauth || !oauth.tokens) {
      return NextResponse.json({ error: 'Not connected' }, { status: 412 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    
    oauth2Client.setCredentials({
      refresh_token: oauth.tokens.refresh_token,
      access_token: oauth.tokens.access_token,
    });

    // Refresh token
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
    } catch (refreshError) {
      return NextResponse.json({ 
        error: 'Token refresh failed',
        details: refreshError.message 
      }, { status: 401 });
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Test 1: Get user profile
    let profile;
    try {
      const profileRes = await gmail.users.getProfile({ userId: 'me' });
      profile = {
        email: profileRes.data.emailAddress,
        messagesTotal: profileRes.data.messagesTotal,
        threadsTotal: profileRes.data.threadsTotal,
      };
    } catch (error) {
      return NextResponse.json({ 
        error: 'Failed to get Gmail profile',
        details: error.message,
        hint: 'Gmail API might not be enabled'
      }, { status: 500 });
    }

    // Test 2: Try to send a simple test email to self
    const testEmail = [
      `From: ${oauth.email}`,
      `To: ${oauth.email}`,
      'Subject: Gmail API Test',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'This is a test email from your application to verify Gmail API sending works.'
    ].join('\r\n');

    const encodedMessage = Buffer.from(testEmail)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    let sendTest;
    try {
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
      sendTest = {
        success: true,
        messageId: result.data.id,
      };
    } catch (error) {
      sendTest = {
        success: false,
        error: error.message,
        code: error.code,
        details: error.response?.data,
      };
    }

    return NextResponse.json({
      connected: true,
      profile,
      sendTest,
      scopes: oauth.tokens.scope,
    });
  } catch (error) {
    console.error('Gmail API test error:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: error.message 
    }, { status: 500 });
  }
}