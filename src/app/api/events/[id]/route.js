import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserFromToken } from '../../../../lib/eventAuthHelper';

// GET /api/events/[id]
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // --- Bug Fix #1.8: Auth guard added — was fully public before ---
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    const event = await db.collection('events').findOne({ _id: new ObjectId(id) });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('Failed to fetch event:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/events/[id]
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Verify token and get user (aligned with /api/auth/check)
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Find the event to check for ownership
    const event = await db.collection('events').findOne({ _id: new ObjectId(id) });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Only the host can delete the event
    if (event.host !== user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the event
    const deleteResult = await db.collection('events').deleteOne({ _id: new ObjectId(id) });

    if (deleteResult.deletedCount === 0) {
        return NextResponse.json({ error: 'Event not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Event deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error('Failed to delete event:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/events/[id]
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const token = request.cookies.get('admin_token')?.value;
    const body = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Verify token and get user (aligned with /api/auth/check)
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Find the event to check for ownership
    const event = await db.collection('events').findOne({ _id: new ObjectId(id) });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Only the host can edit the event
    if (event.host !== user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { title, description, startTime, duration, participants, provider, joinUrl } = body;

    const updatedEventData = {
      title,
      description,
      startTime,
      duration,
      participants,
      updatedAt: new Date(),
    };

    // Optionally update provider and joinUrl. We don't recreate Zoom meetings on edit.
    if (provider) {
      updatedEventData.provider = provider;
    }
    if (provider === 'google_meet') {
      if (!joinUrl || typeof joinUrl !== 'string') {
        return NextResponse.json({ error: 'Google Meet link (joinUrl) is required when provider is google_meet' }, { status: 400 });
      }
      updatedEventData.joinUrl = joinUrl;
    } else if (provider === 'zoom') {
      // Keep existing Zoom joinUrl/zoomMeetingUrl as-is; do not modify here
      // If joinUrl was previously set for google_meet, we leave it untouched unless provider switches.
    }

    // For now, we are not updating the zoom meeting or sending emails on update.
    // This can be added later if needed.

    const updateResult = await db.collection('events').updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedEventData }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Event updated successfully' }, { status: 200 });

  } catch (error) {
    console.error('Failed to update event:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
