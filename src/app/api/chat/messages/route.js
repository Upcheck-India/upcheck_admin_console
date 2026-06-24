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

    // Mark messages as read for this user in this conversation
    await db.collection('chat_messages').updateMany(
      {
        conversationId,
        recipientId: currentUser._id.toString(),
        status: { $ne: 'read' }
      },
      {
        $set: { status: 'read' }
      }
    );

    const query = { conversationId };
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

    const serialized = messages.map(m => ({
      ...m,
      _id: m._id.toString()
    }));

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
