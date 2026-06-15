import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import * as ics from 'ics';
import { computeDaySlots, defaultAvailability } from '../../../../../../lib/scheduling';
import { sendBookingConfirmation } from '../../../../../../lib/bookingEmail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Owner-timezone calendar date ('YYYY-MM-DD') for an instant.
function ownerDateStr(date, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

// POST /api/scheduling/public/[id]/book — create a booking
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const inviteeName = String(body.inviteeName || '').trim();
    const inviteeEmail = String(body.inviteeEmail || '').trim();
    const notes = String(body.notes || '').trim();
    const startIso = body.start;

    if (!inviteeName) return NextResponse.json({ error: 'Your name is required' }, { status: 400 });
    if (!EMAIL_RE.test(inviteeEmail)) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    const start = new Date(startIso);
    if (isNaN(start.getTime())) return NextResponse.json({ error: 'Invalid start time' }, { status: 400 });
    if (start.getTime() < Date.now()) return NextResponse.json({ error: 'That time is in the past' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const et = await db.collection('booking_event_types').findOne({ _id: new ObjectId(id) });
    if (!et || !et.isActive) return NextResponse.json({ error: 'This booking link is not available' }, { status: 404 });

    const availDoc = await db.collection('booking_availability').findOne({ ownerEmail: et.ownerEmail });
    const availability = availDoc
      ? { timezone: availDoc.timezone, weeklyHours: availDoc.weeklyHours }
      : defaultAvailability();
    const tz = availability.timezone;

    const end = new Date(start.getTime() + et.durationMinutes * 60000);

    // Re-validate the requested instant is a real, currently-open slot.
    const dateStr = ownerDateStr(start, tz);
    const existing = await db
      .collection('bookings')
      .find({ eventTypeId: et._id, status: 'confirmed' })
      .project({ startTime: 1, endTime: 1 })
      .toArray();
    const openSlots = computeDaySlots(availability, et.durationMinutes, dateStr, existing, new Date(), 0);
    if (!openSlots.some((s) => s.start === start.toISOString())) {
      return NextResponse.json({ error: 'Sorry, that slot is no longer available. Please pick another.' }, { status: 409 });
    }

    const doc = {
      eventTypeId: et._id,
      eventTypeTitle: et.title,
      ownerEmail: et.ownerEmail,
      ownerName: et.ownerName,
      inviteeName,
      inviteeEmail,
      notes,
      startTime: start,
      endTime: end,
      durationMinutes: et.durationMinutes,
      location: et.location || '',
      timezone: tz,
      status: 'confirmed',
      createdAt: new Date(),
    };
    const result = await db.collection('bookings').insertOne(doc);

    // Build an ICS the invitee can add to their calendar.
    let icsContent = null;
    try {
      const { error, value } = ics.createEvent({
        title: `${et.title} with ${et.ownerName}`,
        description: notes ? `Notes: ${notes}` : et.description || '',
        start: [
          start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(),
          start.getUTCHours(), start.getUTCMinutes(),
        ],
        startInputType: 'utc',
        duration: { minutes: et.durationMinutes },
        status: 'CONFIRMED',
        organizer: { name: et.ownerName, email: et.ownerEmail },
        attendees: [{ name: inviteeName, email: inviteeEmail, rsvp: true, partstat: 'ACCEPTED' }],
        location: et.location || '',
      });
      if (!error) icsContent = value;
    } catch (e) {
      console.error('ICS generation failed', e);
    }

    // Confirmation emails (invitee + owner). Best-effort — never blocks the booking.
    try {
      await sendBookingConfirmation({ ...doc, _id: result.insertedId }, icsContent);
    } catch (e) {
      console.error('Booking confirmation email error:', e?.message);
    }

    return NextResponse.json({
      booking: { ...doc, _id: result.insertedId },
      ics: icsContent,
    }, { status: 201 });
  } catch (e) {
    console.error('public book POST', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
