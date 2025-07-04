import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/events/[id]
export async function GET(request, { params }) {
  try {
    const { id } = params;

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
    const { id } = params;
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Verify token and get user
    const session = await db.collection('admin_sessions').findOne({ sessionToken: token });
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    const user = await db.collection('admin_users').findOne({ _id: session.userId });
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
    const { id } = params;
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

    // Verify token and get user
    const session = await db.collection('admin_sessions').findOne({ sessionToken: token });
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    const user = await db.collection('admin_users').findOne({ _id: session.userId });
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

    const { title, description, startTime, duration, participants } = body;

    const updatedEventData = {
      title,
      description,
      startTime,
      duration,
      participants,
      updatedAt: new Date(),
    };

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
