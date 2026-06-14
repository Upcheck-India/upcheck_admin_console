import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/scheduling/public/[id] — public event-type info for the booking page
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const et = await db.collection('booking_event_types').findOne({ _id: new ObjectId(id) });
    if (!et || !et.isActive) {
      return NextResponse.json({ error: 'This booking link is not available' }, { status: 404 });
    }

    const availability = await db.collection('booking_availability').findOne({ ownerEmail: et.ownerEmail });

    return NextResponse.json({
      eventType: {
        _id: et._id,
        title: et.title,
        description: et.description,
        durationMinutes: et.durationMinutes,
        location: et.location,
        color: et.color,
        ownerName: et.ownerName,
      },
      timezone: availability?.timezone || 'UTC',
    });
  } catch (e) {
    console.error('public event-type GET', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
