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
    const { searchParams } = new URL(request.url);
    const forEveryone = searchParams.get('forEveryone') === 'true';

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 });
    }

    const message = await db.collection('chat_messages').findOne({ _id: new ObjectId(id) });
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Verify participant: current user must be sender or recipient of the message
    const isSender = message.senderId === currentUser._id.toString();
    const isRecipient = message.recipientId === currentUser._id.toString();
    if (!isSender && !isRecipient) {
      return NextResponse.json({ error: 'Unauthorized message access' }, { status: 403 });
    }

    if (forEveryone) {
      if (!isSender) {
        return NextResponse.json({ error: 'Only the sender can delete for everyone' }, { status: 403 });
      }
      await db.collection('chat_messages').updateOne(
        { _id: new ObjectId(id) },
        { $set: { deletedForEveryone: true, body: '[Message deleted]', updatedAt: new Date() } }
      );
    } else {
      await db.collection('chat_messages').updateOne(
        { _id: new ObjectId(id) },
        { $addToSet: { deletedFor: currentUser._id.toString() } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete DM message error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
