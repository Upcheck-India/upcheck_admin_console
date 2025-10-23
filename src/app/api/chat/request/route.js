import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    const { peerId } = await request.json();
    
    if (!peerId) {
      return NextResponse.json({ error: 'Peer ID required' }, { status: 400 });
    }

    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    
    const currentUser = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const peerUser = await db.collection('admin_users').findOne({ _id: new ObjectId(peerId) });
    if (!peerUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check existing connection
    const existing = await db.collection('chat_connections').findOne({
      $or: [
        { userId: currentUser._id.toString(), peerId: peerId },
        { userId: peerId, peerId: currentUser._id.toString() }
      ]
    });

    if (existing) {
      if (existing.status === 'blocked') {
        return NextResponse.json({ error: 'Cannot send request' }, { status: 403 });
      }
      return NextResponse.json({ 
        connection: existing,
        message: 'Connection already exists'
      });
    }

    // Create conversation
    const conversationId = new ObjectId();
    const now = new Date();

    await db.collection('conversations').insertOne({
      _id: conversationId,
      participants: [currentUser._id.toString(), peerId],
      createdAt: now,
      lastMessageAt: null
    });

    // Create connection (pending for receiver)
    await db.collection('chat_connections').insertOne({
      userId: currentUser._id.toString(),
      peerId: peerId,
      conversationId: conversationId.toString(),
      status: 'accepted', // Requester auto-accepts
      initiatedBy: currentUser._id.toString(),
      createdAt: now,
      updatedAt: now
    });

    await db.collection('chat_connections').insertOne({
      userId: peerId,
      peerId: currentUser._id.toString(),
      conversationId: conversationId.toString(),
      status: 'pending', // Receiver needs to accept
      initiatedBy: currentUser._id.toString(),
      createdAt: now,
      updatedAt: now
    });

    return NextResponse.json({
      success: true,
      conversationId: conversationId.toString(),
      status: 'pending'
    });
  } catch (err) {
    console.error('Request error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
