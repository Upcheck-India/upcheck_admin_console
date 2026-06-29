import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    const { conversationId } = await request.json();

    if (!conversationId || !ObjectId.isValid(conversationId)) {
      return NextResponse.json({ error: 'Invalid Conversation ID' }, { status: 400 });
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

    // Mark all messages as deleted for this user in this conversation
    await db.collection('chat_messages').updateMany(
      { conversationId },
      { $set: { deletedFor: currentUser._id.toString() } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Clear chat error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
