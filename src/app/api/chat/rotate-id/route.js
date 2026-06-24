import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    const userIdStr = currentUser._id.toString();

    // Collect conversations to remove
    const convs = await db.collection('conversations')
      .find({ participants: userIdStr })
      .project({ _id: 1 })
      .toArray();

    const convIdsObj = convs.map(c => c._id);
    const convIdsStr = convs.map(c => c._id.toString());

    // Delete messages for these conversations
    if (convIdsStr.length > 0) {
      await db.collection('chat_messages').deleteMany({ conversationId: { $in: convIdsStr } });
    }

    // Delete all connections for and with this user
    await db.collection('chat_connections').deleteMany({
      $or: [
        { userId: userIdStr },
        { peerId: userIdStr }
      ]
    });

    // Delete the conversations themselves
    if (convIdsObj.length > 0) {
      await db.collection('conversations').deleteMany({ _id: { $in: convIdsObj } });
    }

    // Generate a new unique messagingId
    let messagingId;
    for (let i = 0; i < 3; i++) {
      const candidate = crypto.randomBytes(12).toString('hex');
      const exists = await db.collection('admin_users').findOne({ messagingId: candidate });
      if (!exists) { messagingId = candidate; break; }
    }
    if (!messagingId) {
      messagingId = crypto.randomBytes(12).toString('hex');
    }

    await db.collection('admin_users').updateOne(
      { _id: new ObjectId(userIdStr) },
      { $set: { messagingId } }
    );

    return NextResponse.json({ success: true, messagingId });
  } catch (err) {
    console.error('Rotate messaging ID error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
