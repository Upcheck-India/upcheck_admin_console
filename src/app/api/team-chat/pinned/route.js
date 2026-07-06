import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    }

    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { db } = auth;

    const now = new Date();
    const pinnedMessages = await db.collection('team_messages')
      .find({
        teamId,
        pinned: true,
        $or: [
          { pinExpiresAt: null },
          { pinExpiresAt: { $gt: now } }
        ]
      })
      .sort({ pinnedAt: -1 })
      .toArray();

    // Map sender names
    const senderIds = [...new Set(pinnedMessages.map(m => m.senderId).filter(Boolean))];
    const senders = await db.collection('admin_users')
      .find({ _id: { $in: senderIds.map(id => new ObjectId(id)) } })
      .toArray();
    const senderMap = senders.reduce((acc, u) => {
      acc[u._id.toString()] = u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username;
      return acc;
    }, {});

    const serialized = pinnedMessages.map(m => ({
      ...m,
      _id: m._id.toString(),
      senderName: senderMap[m.senderId] || 'Member'
    }));

    return NextResponse.json({ pinnedMessages: serialized });
  } catch (err) {
    console.error('Fetch Team pinned messages error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
