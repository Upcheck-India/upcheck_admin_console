import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../../lib/mongodb';
import { google } from 'googleapis';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL('/mail?oauth_error=' + encodeURIComponent(error), request.url));
    }

    const cookieStore = await cookies();
    const savedState = cookieStore.get('mail_oauth_state')?.value;
    cookieStore.set('mail_oauth_state', '', { path: '/', maxAge: 0 });
    if (!code || !state || !savedState || state !== savedState) {
      return NextResponse.redirect(new URL('/mail?oauth_error=invalid_state', request.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || url.origin;
    const redirectUri = `${origin}/api/mail/oauth/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/mail?oauth_error=server_config', request.url));
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user email from Google
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo?.data?.email;

    const tokenCookie = cookieStore.get('admin_token')?.value;
    if (!tokenCookie) {
      return NextResponse.redirect(new URL('/mail?oauth_error=unauthorized', request.url));
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: tokenCookie });
    if (!user) {
      return NextResponse.redirect(new URL('/mail?oauth_error=user_not_found', request.url));
    }

    const userId = user._id.toString();

    // Preserve existing refresh_token if Google didn't return a new one (common on re-consent without prompt=consent)
    const existing = await db.collection('mail_oauth').findOne({ userId, provider: 'google' });
    const refresh_token = tokens.refresh_token || existing?.tokens?.refresh_token;

    await db.collection('mail_oauth').updateOne(
      { userId, provider: 'google' },
      {
        $set: {
          userId,
          provider: 'google',
          email: googleEmail || user.email,
          tokens: {
            access_token: tokens.access_token || existing?.tokens?.access_token || null,
            refresh_token: refresh_token || null,
            expiry_date: tokens.expiry_date || null,
            scope: tokens.scope || existing?.tokens?.scope || null,
            token_type: tokens.token_type || existing?.tokens?.token_type || 'Bearer',
          },
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.redirect(new URL('/mail/settings/success', request.url));
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(new URL('/mail?oauth_error=internal', request.url));
  }
}
