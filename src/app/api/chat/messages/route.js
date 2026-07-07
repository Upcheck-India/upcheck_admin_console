import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const before = searchParams.get('before'); // ObjectId cursor for pagination

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    if (!ObjectId.isValid(conversationId)) {
      return NextResponse.json({ error: 'Invalid Conversation ID' }, { status: 400 });
    }

    if (before && !ObjectId.isValid(before)) {
      return NextResponse.json({ error: 'Invalid before cursor' }, { status: 400 });
    }

    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    // Verify user is participant
    const conversation = await db.collection('conversations').findOne({
      _id: new ObjectId(conversationId),
      participants: currentUser._id.toString()
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Mark messages as read for this user in this conversation. updatedAt
    // must be bumped here too — the sender's poll for this conversation
    // (chat/poll route) only picks up messages with createdAt/updatedAt
    // past its last-seen cursor, so without this the blue "read" tick
    // never reaches a sender who is no longer inside the initial poll
    // window.
    await db.collection('chat_messages').updateMany(
      {
        conversationId,
        recipientId: currentUser._id.toString(),
        status: { $ne: 'read' }
      },
      {
        $set: { status: 'read', readAt: new Date(), updatedAt: new Date() }
      }
    );

    const query = { 
      conversationId,
      deletedFor: { $ne: currentUser._id.toString() }
    };
    if (before) {
      try {
        query._id = { $lt: new ObjectId(before) };
      } catch {
        // Invalid ObjectId, ignore
      }
    }

    const messages = await db.collection('chat_messages')
      .find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .toArray();

    const now = new Date();
    const serialized = messages.map(m => {
      const pinExpired = m.pinned && m.pinExpiresAt && new Date(m.pinExpiresAt) < now;
      return {
        ...m,
        _id: m._id.toString(),
        pinned: pinExpired ? false : !!m.pinned,
        pinnedAt: pinExpired ? null : m.pinnedAt,
        pinnedBy: pinExpired ? null : m.pinnedBy,
        pinExpiresAt: pinExpired ? null : m.pinExpiresAt
      };
    });

    return NextResponse.json({
      messages: serialized,
      hasMore: messages.length === limit,
      nextCursor: messages.length > 0 ? messages[messages.length - 1]._id.toString() : null
    });
  } catch (err) {
    console.error('Messages error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
