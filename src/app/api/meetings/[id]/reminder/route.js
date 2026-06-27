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
 * POST /api/meetings/[id]/reminder
 * Upserts the authenticated user's reminder setting for this meeting.
 *
 * Body: { minutesBefore: number }  (e.g. 5, 10, 15, 30, 60)
 *
 * Returns: { success: true, minutesBefore: number }
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
    const minutesBefore = Number(body.minutesBefore);

    if (!Number.isFinite(minutesBefore) || minutesBefore < 1 || minutesBefore > 1440) {
      return NextResponse.json(
        { error: 'minutesBefore must be a number between 1 and 1440.' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const meeting = await db.collection('events').findOne(
      { _id: objectId },
      { projection: { _id: 1 } }
    );

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    }

    const reminderEntry = {
      userId: user._id.toString(),
      email: user.email,
      minutesBefore,
      updatedAt: new Date(),
    };

    // Pull any existing reminder for this user, then push new one (upsert pattern)
    await db.collection('events').updateOne(
      { _id: objectId },
      { $pull: { reminderSettings: { email: { $regex: `^${user.email}$`, $options: 'i' } } } }
    );

    await db.collection('events').updateOne(
      { _id: objectId },
      {
        $push: { reminderSettings: reminderEntry },
        $set: { updatedAt: new Date() },
      }
    );

    return NextResponse.json({ success: true, minutesBefore });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/reminder] Error:', error);
    return NextResponse.json({ error: 'Failed to set reminder.' }, { status: 500 });
  }
}
