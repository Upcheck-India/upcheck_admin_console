import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import crypto from 'crypto';

// Initialize messaging ID for current user and create indexes (idempotent)
export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    // Generate messaging ID for current user if missing
    let messagingId = currentUser.messagingId;
    if (!messagingId) {
      messagingId = crypto.randomBytes(12).toString('hex'); // 24-char hex
      await db.collection('admin_users').updateOne(
        { _id: currentUser._id },
        { $set: { messagingId } }
      );
    }

    // Create indexes
    await db.collection('admin_users').createIndex({ messagingId: 1 }, { unique: true, sparse: true });
    await db.collection('chat_connections').createIndex({ userId: 1, status: 1 });
    await db.collection('chat_connections').createIndex({ userId: 1, status: 1, updatedAt: 1 });
    await db.collection('chat_connections').createIndex({ userId: 1, peerId: 1 });
    await db.collection('chat_messages').createIndex({ conversationId: 1, createdAt: -1 });
    await db.collection('chat_messages').createIndex({ recipientId: 1, status: 1 });
    await db.collection('chat_messages').createIndex({ clientId: 1 }, { sparse: true });
    await db.collection('conversations').createIndex({ participants: 1 });

    return NextResponse.json({ success: true, messagingId });
  } catch (err) {
    console.error('Init error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
