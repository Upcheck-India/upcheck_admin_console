import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since'); // ISO timestamp
    const conversationId = searchParams.get('conversationId'); // Optional: poll specific conversation

    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    
    const currentUser = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000); // Default: last 1 min

    const updates = {
      newMessages: [],
      pendingRequests: [],
      connectionUpdates: []
    };

    // If polling specific conversation
    if (conversationId) {
      const newMessages = await db.collection('chat_messages')
        .find({
          conversationId,
          createdAt: { $gt: sinceDate }
        })
        .sort({ createdAt: 1 })
        .toArray();

      updates.newMessages = newMessages.map(m => ({
        ...m,
        _id: m._id.toString()
      }));
    } else {
      // Poll all conversations
      const myConnections = await db.collection('chat_connections')
        .find({ userId: currentUser._id.toString(), status: { $in: ['accepted', 'pending'] } })
        .toArray();

      const conversationIds = myConnections.map(c => c.conversationId).filter(Boolean);

      if (conversationIds.length > 0) {
        const newMessages = await db.collection('chat_messages')
          .find({
            conversationId: { $in: conversationIds },
            createdAt: { $gt: sinceDate },
            senderId: { $ne: currentUser._id.toString() } // Exclude own messages
          })
          .sort({ createdAt: 1 })
          .toArray();

        updates.newMessages = newMessages.map(m => ({
          ...m,
          _id: m._id.toString()
        }));
      }

      // Check for new pending requests
      const pendingRequests = await db.collection('chat_connections')
        .find({
          userId: currentUser._id.toString(),
          status: 'pending',
          updatedAt: { $gt: sinceDate }
        })
        .toArray();

      if (pendingRequests.length > 0) {
        const peerIds = pendingRequests.map(r => r.peerId);
        const peers = await db.collection('admin_users')
          .find(
            { _id: { $in: peerIds.map(id => new ObjectId(id)) } },
            { projection: { _id: 1, username: 1, name: 1, email: 1 } }
          )
          .toArray();

        const peerMap = peers.reduce((acc, p) => {
          acc[p._id.toString()] = p;
          return acc;
        }, {});

        updates.pendingRequests = pendingRequests.map(r => ({
          ...r,
          _id: r._id?.toString(),
          peer: peerMap[r.peerId]
        }));
      }

      // Check for connection status changes
      const connectionUpdates = await db.collection('chat_connections')
        .find({
          userId: currentUser._id.toString(),
          status: { $in: ['revoked', 'blocked'] },
          updatedAt: { $gt: sinceDate }
        })
        .toArray();

      updates.connectionUpdates = connectionUpdates.map(c => ({
        ...c,
        _id: c._id?.toString()
      }));
    }

    return NextResponse.json(updates);
  } catch (err) {
    console.error('Poll error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
