import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { db } = auth;

    // Retrieve active pins (dynamic validation of expiration)
    const now = new Date();
    const pinnedMessages = await db.collection('chat_messages')
      .find({
        conversationId,
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
      senderName: senderMap[m.senderId] || 'Teammate'
    }));

    return NextResponse.json({ pinnedMessages: serialized });
  } catch (err) {
    console.error('Fetch DM pinned messages error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
