import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserFromToken } from '../../../../lib/eventAuthHelper';

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
 * Enriches a meeting document with computed fields and per-user RSVP status.
 */
function enrichMeeting(meeting, userEmail) {
  const now = new Date();
  const startTime = new Date(meeting.startTime);
  const endTime = meeting.endTime
    ? new Date(meeting.endTime)
    : new Date(startTime.getTime() + (meeting.duration || 30) * 60000);
  const myRsvp = (meeting.rsvps || []).find(
    (r) => r.email && r.email.toLowerCase() === (userEmail || '').toLowerCase()
  );
  return {
    _id: meeting._id.toString(),
    title: meeting.overrides?.title || meeting.title,
    description: meeting.overrides?.description || meeting.description,
    host: meeting.host,
    hostId: meeting.hostId,
    duration: meeting.overrides?.duration || meeting.duration,
    participants: meeting.overrides?.participants || meeting.participants || [],
    teams: meeting.overrides?.teams || meeting.teams || [],
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    provider: meeting.provider,
    joinUrl: meeting.joinUrl || meeting.zoomMeetingUrl,
    useInterstitialJoin: !!meeting.useInterstitialJoin,
    redirectDelay: meeting.redirectDelay || 5,
    status: meeting.status || 'scheduled',
    momDocuments: meeting.momDocuments || [],
    isRecurring: !!meeting.seriesId,
    seriesId: meeting.seriesId || null,
    isInProgress: now >= startTime && now <= endTime,
    isPast: now > endTime,
    isUpcoming: now < startTime,
    reactions: meeting.reactions || [],
    rsvps: meeting.rsvps || [],
    myRsvp: myRsvp ? myRsvp.status : null,
    reminderSettings: meeting.reminderSettings || [],
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
  };
}

/**
 * GET /api/meetings/[id]
 * Returns a single meeting by ID.
 * RBAC: user must be host OR in participants array (case-insensitive).
 */
export async function GET(request, { params }) {
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

    const client = await clientPromise;
    const db = client.db('resources');

    const meeting = await db.collection('events').findOne({ _id: objectId });

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    }

    const userEmail = user.email.toLowerCase();
    const isHost = (meeting.host || '').toLowerCase() === userEmail;
    const isParticipant = (meeting.participants || []).some(
      (p) => p && p.toLowerCase() === userEmail
    );

    if (!isHost && !isParticipant) {
      return NextResponse.json({ error: 'Forbidden. You are not a participant of this meeting.' }, { status: 403 });
    }

    return NextResponse.json({ success: true, meeting: enrichMeeting(meeting, user.email) });
  } catch (error) {
    console.error('[GET /api/meetings/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch meeting.' }, { status: 500 });
  }
}

/**
 * PATCH /api/meetings/[id]
 * Updates the meeting's status field.
 * Body: { status: string }
 * RBAC: must be host.
 */
export async function PATCH(request, { params }) {
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

    const client = await clientPromise;
    const db = client.db('resources');

    const meeting = await db.collection('events').findOne({ _id: objectId }, { projection: { host: 1 } });

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    }

    const isHost = (meeting.host || '').toLowerCase() === user.email.toLowerCase();
    if (!isHost) {
      return NextResponse.json({ error: 'Forbidden. Only the host can update this meeting.' }, { status: 403 });
    }

    const body = await request.json();
    const { status } = body;

    const allowedStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await db.collection('events').findOneAndUpdate(
      { _id: objectId },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    return NextResponse.json({ success: true, meeting: enrichMeeting(result, user.email) });
  } catch (error) {
    console.error('[PATCH /api/meetings/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to update meeting.' }, { status: 500 });
  }
}
