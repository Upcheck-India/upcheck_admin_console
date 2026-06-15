import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    const { conversationId, body, clientId } = await request.json();
    
    if (!conversationId || !body?.trim()) {
      return NextResponse.json({ error: 'Conversation ID and message body required' }, { status: 400 });
    }

    if (!ObjectId.isValid(conversationId)) {
      return NextResponse.json({ error: 'Invalid Conversation ID' }, { status: 400 });
    }

    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    
    const currentUser = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify conversation and connection
    const conversation = await db.collection('conversations').findOne({ 
      _id: new ObjectId(conversationId),
      participants: currentUser._id.toString()
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const recipientId = conversation.participants.find(p => p !== currentUser._id.toString());

    // Check connection status
    const connection = await db.collection('chat_connections').findOne({
      userId: currentUser._id.toString(),
      peerId: recipientId,
      status: 'accepted'
    });

    if (!connection) {
      return NextResponse.json({ error: 'Connection not accepted' }, { status: 403 });
    }

    // Check for duplicate (by clientId)
    if (clientId) {
      const existing = await db.collection('chat_messages').findOne({ clientId });
      if (existing) {
        return NextResponse.json({ message: existing });
      }
    }

    const now = new Date();
    const messageId = new ObjectId();

    const message = {
      _id: messageId,
      conversationId,
      senderId: currentUser._id.toString(),
      recipientId,
      body: body.trim(),
      status: 'sent',
      createdAt: now,
      clientId: clientId || null
    };

    await db.collection('chat_messages').insertOne(message);

    // Update conversation last message time
    await db.collection('conversations').updateOne(
      { _id: new ObjectId(conversationId) },
      { $set: { lastMessageAt: now } }
    );

    return NextResponse.json({
      message: {
        ...message,
        _id: message._id.toString()
      }
    });
  } catch (err) {
    console.error('Send message error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
