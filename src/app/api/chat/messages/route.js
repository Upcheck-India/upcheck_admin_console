import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
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

    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    
    const currentUser = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify user is participant
    const conversation = await db.collection('conversations').findOne({
      _id: new ObjectId(conversationId),
      participants: currentUser._id.toString()
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

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
