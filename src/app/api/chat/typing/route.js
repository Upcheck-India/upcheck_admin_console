import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    const { conversationId } = await request.json();
    if (!conversationId || !ObjectId.isValid(conversationId)) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    const conversation = await db.collection('conversations').findOne({
      _id: new ObjectId(conversationId),
      participants: currentUser._id.toString()
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 403 });
    }

    const name = currentUser.firstName && currentUser.lastName
      ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
      : currentUser.username;

    await db.collection('dm_typing').updateOne(
      { conversationId, userId: currentUser._id.toString() },
      {
        $set: {
          username: currentUser.username,
          name,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DM chat typing error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
