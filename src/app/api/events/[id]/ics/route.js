import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import * as ics from 'ics';

// GET /api/events/[id]/ics
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    const event = await db.collection('events').findOne({ _id: new ObjectId(id) });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { title, description, startTime, duration } = event;
    const startDate = new Date(startTime);

    const eventData = {
      title,
      description: `${description || ''}\n\nJoin: ${event.joinUrl || event.zoomMeetingUrl || ''}`.trim(),
      // Use UTC components to avoid timezone drift across clients
      start: [
        startDate.getUTCFullYear(),
        startDate.getUTCMonth() + 1,
        startDate.getUTCDate(),
        startDate.getUTCHours(),
        startDate.getUTCMinutes(),
      ],
      startInputType: 'utc',
      duration: { minutes: duration },
      status: 'CONFIRMED',
      method: 'REQUEST',
      organizer: { name: 'Upcheck Admin', email: event.host },
      url: event.joinUrl || event.zoomMeetingUrl,
      location: event.provider === 'google_meet' ? 'Google Meet' : 'Zoom',
      alarms: [
        {
          action: 'display',
          description: 'Event reminder',
          trigger: { minutes: 15, before: true },
        },
      ],
      attendees: event.participants.map(p => ({ email: p, rsvp: true, partstat: 'NEEDS-ACTION' })),
    };

    const { error, value } = ics.createEvent(eventData);

    if (error) {
      console.error('Failed to create ICS file:', error);
      return NextResponse.json({ error: 'Failed to generate calendar file.' }, { status: 500 });
    }

    const headers = new Headers();
    headers.set('Content-Type', 'text/calendar; charset=utf-8');
    headers.set('Content-Disposition', `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`);

    return new NextResponse(value, { status: 200, headers });

  } catch (error) {
    console.error('ICS generation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
