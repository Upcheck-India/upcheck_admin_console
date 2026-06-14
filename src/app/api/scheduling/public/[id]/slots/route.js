import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { computeDaySlots, defaultAvailability } from '../../../../../../lib/scheduling';

// GET /api/scheduling/public/[id]/slots?date=YYYY-MM-DD — open slots for a day
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'A valid date (YYYY-MM-DD) is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const et = await db.collection('booking_event_types').findOne({ _id: new ObjectId(id) });
    if (!et || !et.isActive) return NextResponse.json({ error: 'Not available' }, { status: 404 });

    const availDoc = await db.collection('booking_availability').findOne({ ownerEmail: et.ownerEmail });
    const availability = availDoc
      ? { timezone: availDoc.timezone, weeklyHours: availDoc.weeklyHours }
      : defaultAvailability();

    // Existing confirmed bookings that could overlap this day (±1 day window for tz safety).
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const windowStart = new Date(dayStart.getTime() - 24 * 3600 * 1000);
    const windowEnd = new Date(dayStart.getTime() + 48 * 3600 * 1000);
    const bookings = await db
      .collection('bookings')
      .find({
        eventTypeId: et._id,
        status: 'confirmed',
        startTime: { $gte: windowStart, $lt: windowEnd },
      })
      .project({ startTime: 1, endTime: 1 })
      .toArray();

    const slots = computeDaySlots(availability, et.durationMinutes, date, bookings, new Date(), 0);

    return NextResponse.json({ slots, timezone: availability.timezone, durationMinutes: et.durationMinutes });
  } catch (e) {
    console.error('public slots GET', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
