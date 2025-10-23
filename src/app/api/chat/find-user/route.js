import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';

export async function POST(request) {
  try {
    const { messagingId } = await request.json();
    
    if (!messagingId?.trim()) {
      return NextResponse.json({ error: 'Messaging ID required' }, { status: 400 });
    }

    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    
    const currentUser = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Don't allow finding yourself
    if (currentUser.messagingId === messagingId) {
      return NextResponse.json({ error: 'Cannot chat with yourself' }, { status: 400 });
    }

    const targetUser = await db.collection('admin_users').findOne(
      { messagingId: messagingId.trim() },
      { projection: { _id: 1, username: 1, email: 1, name: 1, messagingId: 1 } }
    );

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if connection already exists
    const connection = await db.collection('chat_connections').findOne({
      $or: [
        { userId: currentUser._id.toString(), peerId: targetUser._id.toString() },
        { userId: targetUser._id.toString(), peerId: currentUser._id.toString() }
      ]
    });

    return NextResponse.json({
      user: {
        id: targetUser._id.toString(),
        username: targetUser.username,
        email: targetUser.email,
        name: targetUser.name,
        messagingId: targetUser.messagingId
      },
      connection: connection ? {
        status: connection.status,
        conversationId: connection.conversationId
      } : null
    });
  } catch (err) {
    console.error('Find user error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
