import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

async function getAuthUser(req) {
  const authHeader = req.headers.get('authorization');
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const cookieStore = cookies();
    token = cookieStore.get('admin_token')?.value;
  }
  if (!token) return null;
  const client = await clientPromise;
  const db = client.db('resources');
  return await db.collection('admin_users').findOne({ sessionToken: token });
}

export async function GET(request) {
  try {
    const currentUser = await getAuthUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const since = searchParams.get('since'); // ISO string

    if (!teamId || !ObjectId.isValid(teamId)) {
      return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify membership
    const team = await db.collection('teams').findOne({
      _id: new ObjectId(teamId),
      $or: [
        { members: currentUser._id.toString() },
        { lead: currentUser._id.toString() },
        { members: currentUser._id },
        { lead: currentUser._id },
      ],
    });

    if (!team) return NextResponse.json({ error: 'Not a team member' }, { status: 403 });

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000);
    const serverTimestamp = new Date().toISOString();

    const updates = {
      newMessages: [],
      typingUsers: [],
      serverTimestamp,
    };

    // Mark user as online (side effect of polling)
    await db.collection('admin_users').updateOne(
      { _id: currentUser._id },
      { $set: { lastActive: new Date() } }
    );

    // Fetch new messages
    const newMessages = await db.collection('team_messages')
      .find({
        teamId,
        createdAt: { $gt: sinceDate },
        deletedForEveryone: { $ne: true }
      })
      .sort({ createdAt: 1 })
      .toArray();

    const userId = currentUser._id.toString();

    // Mark them as read for current user
    const msgIdsToRead = newMessages
      .filter(m => m.senderId !== userId && !m.readBy?.some(r => r.userId === userId))
      .map(m => m._id);

    if (msgIdsToRead.length > 0) {
      await db.collection('team_messages').updateMany(
        { _id: { $in: msgIdsToRead } },
        { $push: { readBy: { userId, readAt: new Date() } } }
      );
    }

    updates.newMessages = newMessages
      .filter(m => !m.deletedFor?.includes(userId))
      .map(m => ({ ...m, _id: m._id.toString(), replyTo: m.replyTo ? m.replyTo.toString() : null }));

    // Fetch typing status
    // Typing indicators are short-lived. Find anyone updated in the last 5 seconds.
    const typingSince = new Date(Date.now() - 5000);
    const typingDocs = await db.collection('team_typing')
      .find({
        teamId,
        userId: { $ne: userId },
        updatedAt: { $gt: typingSince }
      })
      .toArray();

    updates.typingUsers = typingDocs.map(d => ({
      userId: d.userId,
      username: d.username,
      name: d.name
    }));

    return NextResponse.json(updates);
  } catch (err) {
    console.error('Team chat poll error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
