import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

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

export async function POST(req, { params }) {
  try {
    const { id: groupId, messageId } = await params;
    const { emoji } = await req.json();

    if (!ObjectId.isValid(groupId) || !ObjectId.isValid(messageId) || !emoji) {
      return NextResponse.json({ error: 'Invalid ID or Emoji' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    let user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const message = await db.collection('group_chat_messages').findOne({ _id: new ObjectId(messageId), groupId });
    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    const userId = user._id.toString();
    const reactions = message.reactions || [];
    const existingIndex = reactions.findIndex(r => r.userId === userId && r.emoji === emoji);

    if (existingIndex > -1) {
      // Pull reaction
      await db.collection('group_chat_messages').updateOne(
        { _id: new ObjectId(messageId) },
        { $pull: { reactions: { userId, emoji } } }
      );
    } else {
      // Push reaction
      await db.collection('group_chat_messages').updateOne(
        { _id: new ObjectId(messageId) },
        { $push: { reactions: { userId, username: user.username, emoji, createdAt: new Date() } } }
      );
    }

    const updatedMessage = await db.collection('group_chat_messages').findOne({ _id: new ObjectId(messageId) });
    return NextResponse.json({ success: true, reactions: updatedMessage.reactions || [] });
  } catch (err) {
    console.error('Group React error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
