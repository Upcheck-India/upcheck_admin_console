import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = authData.user;
    const db = authData.db;

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const since = searchParams.get('since'); // ISO string

    if (!teamId || !ObjectId.isValid(teamId)) {
      return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    }

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
      .aggregate([
        {
          $match: {
            teamId,
            $or: [
              { createdAt: { $gt: sinceDate } },
              { status: 'streaming', updatedAt: { $gt: sinceDate } }
            ],
            deletedForEveryone: { $ne: true }
          }
        },
        { $sort: { createdAt: 1 } },
        {
          $lookup: {
            from: 'admin_users',
            let: { senderId: "$senderId" },
            pipeline: [
              { $match: { $expr: { $eq: [ { $toString: "$_id" }, "$$senderId" ] } } },
              { $project: { firstName: 1, lastName: 1, name: 1, username: 1, avatar: 1 } }
            ],
            as: 'senderDetails'
          }
        }
      ])
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
      .map(m => {
        const details = m.senderDetails?.[0];
        let resolvedName = m.senderName;
        if (details) {
          if (details.firstName || details.lastName) {
            resolvedName = `${details.firstName || ''} ${details.lastName || ''}`.trim();
          } else if (details.name) {
            resolvedName = details.name;
          } else if (details.username) {
            resolvedName = details.username;
          }
        }
        if (!resolvedName) {
          resolvedName = m.senderUsername || 'Unknown';
        }
        const resolvedAvatar = details?.avatar || m.senderAvatar || '';

        return {
          ...m,
          _id: m._id.toString(),
          senderName: resolvedName,
          senderAvatar: resolvedAvatar,
          replyTo: m.replyTo ? m.replyTo.toString() : null,
          senderDetails: undefined,
        };
      });

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
