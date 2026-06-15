import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
import crypto from 'crypto';

// Initialize messaging ID for current user and create indexes (idempotent)
export async function POST() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    
    const currentUser = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
