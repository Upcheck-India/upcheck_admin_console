import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

async function getUserFromToken(token, db) {
  if (!token) return null;
  return db.collection('admin_users').findOne(
    { sessionToken: token },
    { projection: { _id: 1, email: 1, name: 1, role: 1 } }
  );
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const token = request.cookies.get('admin_token')?.value;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const user = await getUserFromToken(token, db);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = await db.collection('events').findOne({ _id: new ObjectId(id) });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Only host can force the bot to join
    if (event.host !== user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (event.provider !== 'google_meet') {
      return NextResponse.json({ error: 'Bot join currently supported only for Google Meet' }, { status: 400 });
    }

    if (!event.joinUrl) {
      return NextResponse.json({ error: 'Missing meeting join URL for this event' }, { status: 400 });
    }

    const botUrl = process.env.UPCHECK_BOT_URL;
    if (!botUrl) {
      return NextResponse.json({ error: 'UPCHECK_BOT_URL not configured on server' }, { status: 500 });
    }

    const res = await fetch(`${botUrl.replace(/\/$/, '')}/api/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: event._id,
        meetingUrl: event.joinUrl,
        displayName: 'Upcheck Bot',
        options: { muteAudio: true, disableVideo: true }
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ error: data.error || 'Failed to trigger bot join' }, { status: res.status });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ message: 'Bot join requested', result: data }, { status: 200 });
  } catch (error) {
    console.error('Failed to force bot join:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
