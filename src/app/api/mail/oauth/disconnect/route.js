import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../../lib/mongodb';

export async function POST() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = user._id.toString();
    await db.collection('mail_oauth').deleteOne({ userId, provider: 'google' });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('OAuth disconnect error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
