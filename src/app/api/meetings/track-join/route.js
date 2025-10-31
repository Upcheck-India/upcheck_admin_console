import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { meetingId, email, meetingUrl, at, ua } = body || {};

    const client = await clientPromise;
    const db = client.db('resources');

    await db.collection('meeting_join_events').insertOne({
      meetingId: meetingId || null,
      email: email || null,
      meetingUrl: meetingUrl || null,
      at: at ? new Date(at) : new Date(),
      ua: ua || request.headers.get('user-agent') || null,
      ip: request.headers.get('x-forwarded-for') || null,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('POST /api/meetings/track-join error', e);
    return NextResponse.json({ success: false });
  }
}
