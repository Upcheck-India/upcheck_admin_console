import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { getAuthUser } from '../../../../../../lib/auth.js';

export async function POST(request, { params }) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = authData.user;
    const db = authData.db;

    const { id } = await params;
    const { emoji } = await request.json();

    if (!ObjectId.isValid(id) || !emoji) {
      return NextResponse.json({ error: 'Invalid ID or Emoji' }, { status: 400 });
    }

    const message = await db.collection('team_messages').findOne({ _id: new ObjectId(id) });
    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    const userId = currentUser._id.toString();
    const reactions = message.reactions || [];
    const existingIndex = reactions.findIndex(r => r.userId === userId && r.emoji === emoji);

    if (existingIndex > -1) {
      // Pull reaction
      await db.collection('team_messages').updateOne(
        { _id: new ObjectId(id) },
        { $pull: { reactions: { userId, emoji } } }
      );
    } else {
      // Push reaction
      await db.collection('team_messages').updateOne(
        { _id: new ObjectId(id) },
        { $push: { reactions: { userId, username: currentUser.username, emoji, createdAt: new Date() } } }
      );
    }

    const updatedMessage = await db.collection('team_messages').findOne({ _id: new ObjectId(id) });
    return NextResponse.json({ success: true, reactions: updatedMessage.reactions || [] });
  } catch (err) {
    console.error('Team React error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
