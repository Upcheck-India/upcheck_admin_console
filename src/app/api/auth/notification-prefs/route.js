import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';

const VALID_CATEGORIES = ['meeting', 'message'];

// POST { meeting?: string, message?: string } — each value is either a
// sound key (matching a bundled notification sound's Android resource
// name / filename-without-extension) or 'system_default' to opt out of a
// custom sound for that category. Stored on the user doc (mirrors the
// existing expoPushToken pattern) so sendPushNotification can pick the
// right Android channel / iOS sound per recipient, not just per device —
// this can't live in client-only storage since another process (the
// server sending the push) needs to know the choice.
export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      const cookieStore = cookies();
      token = cookieStore.get('admin_token')?.value;
    }

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const update = {};
    for (const category of VALID_CATEGORIES) {
      if (typeof body[category] === 'string' && body[category].trim()) {
        update[`notificationSounds.${category}`] = body[category].trim();
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: false, error: 'At least one of meeting/message is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const currentUser = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await db.collection('admin_users').updateOne(
      { _id: currentUser._id },
      { $set: { ...update, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification prefs update error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
