import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserFromToken } from '../../../../../lib/eventAuthHelper';

/**
 * Resolves the authenticated user from Bearer token (mobile) or cookie (web).
 */
async function getUser(request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : request.cookies.get('admin_token')?.value;
  return token ? await getUserFromToken(token) : null;
}

/**
 * POST /api/meetings/[id]/rsvp
 * Toggles/upserts the authenticated user's RSVP status for a meeting.
 *
 * Body: { status: 'attend' | 'not_attend' }
 * RBAC: user must be a participant or host of the meeting.
 *
 * Returns: { success: true, rsvps: [...] }
 */
export async function POST(request, { params }) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    const { id } = await params;

    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid meeting ID.' }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !['attend', 'not_attend'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Allowed values: "attend", "not_attend".' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const meeting = await db.collection('events').findOne(
      { _id: objectId },
      { projection: { host: 1, participants: 1 } }
    );

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    }

    const userEmail = user.email.toLowerCase();
    const isHost = (meeting.host || '').toLowerCase() === userEmail;
    const isParticipant = (meeting.participants || []).some(
      (p) => p && p.toLowerCase() === userEmail
    );

    if (!isHost && !isParticipant) {
      return NextResponse.json(
        { error: 'Forbidden. You are not a participant of this meeting.' },
        { status: 403 }
      );
    }

    const rsvpEntry = {
      email: user.email,
      userId: user._id.toString(),
      name: user.name || user.email,
      status,
      updatedAt: new Date(),
    };

    // Remove any existing RSVP for this user, then push the new one (upsert pattern)
    const result = await db.collection('events').findOneAndUpdate(
      { _id: objectId },
      {
        $pull: { rsvps: { email: { $regex: `^${user.email}$`, $options: 'i' } } },
      },
      { returnDocument: 'before' }
    );

    // Push the new RSVP entry after the pull
    const updated = await db.collection('events').findOneAndUpdate(
      { _id: objectId },
      {
        $push: { rsvps: rsvpEntry },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    return NextResponse.json({
      success: true,
      rsvps: updated?.rsvps || [],
      myRsvp: status,
    });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/rsvp] Error:', error);
    return NextResponse.json({ error: 'Failed to update RSVP.' }, { status: 500 });
  }
}
