import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { getAuthUser } from '../../../../../lib/auth.js';

export async function POST(request) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = authData.user;
    const db = authData.db;

    const { messageIds, forEveryone } = await request.json();
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: 'messageIds array required' }, { status: 400 });
    }

    const objectIds = messageIds.map(id => new ObjectId(id));
    const userIdStr = currentUser._id.toString();

    if (forEveryone) {
      await db.collection('chat_messages').updateMany(
        { _id: { $in: objectIds }, senderId: userIdStr },
        { $set: { deletedForEveryone: true, updatedAt: new Date() } }
      );
    } else {
      await db.collection('chat_messages').updateMany(
        { _id: { $in: objectIds } },
        { $addToSet: { deletedFor: userIdStr } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Bulk delete direct messages error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
