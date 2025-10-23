import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { google } from 'googleapis';

export async function GET(request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || new URL(request.url).origin;
  const redirectUri = `${origin}/api/mail/oauth/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Missing Google OAuth env' }, { status: 500 });
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const state = Math.random().toString(36).slice(2);

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    state,
  });

  const cookieStore = await cookies();
  cookieStore.set('mail_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: true, path: '/' });

  return NextResponse.redirect(url);
}
