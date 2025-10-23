import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../../lib/mongodb';

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ connected: false });

    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) return NextResponse.json({ connected: false });

    const userId = user._id.toString();
    const doc = await db.collection('mail_oauth').findOne({ userId, provider: 'google' });
    const connected = !!(doc && doc.tokens && (doc.tokens.refresh_token || doc.tokens.access_token));

    return NextResponse.json({ connected, email: doc?.email || user.email });
  } catch (err) {
    console.error('OAuth status error:', err);
    return NextResponse.json({ connected: false });
  }
}
