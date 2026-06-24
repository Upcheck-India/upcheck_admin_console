import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since'); // ISO timestamp
    const conversationId = searchParams.get('conversationId'); // Optional: poll specific conversation

    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000); // Default: last 1 min
    const serverTimestamp = new Date().toISOString();

    const updates = {
      newMessages: [],
      pendingRequests: [],
      connectionUpdates: [],
      serverTimestamp
    };

    // If polling specific conversation
    if (conversationId) {
      if (!ObjectId.isValid(conversationId)) {
        return NextResponse.json({ error: 'Invalid Conversation ID' }, { status: 400 });
      }

      // Verify authorization: current user must be a participant of the conversation
      const conversation = await db.collection('conversations').findOne({
        _id: new ObjectId(conversationId),
        participants: currentUser._id.toString()
      });

      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 403 });
      }

      // Mark messages as read for this user in this conversation since they have it open
      await db.collection('chat_messages').updateMany(
        {
          conversationId,
          recipientId: currentUser._id.toString(),
          status: { $ne: 'read' }
        },
        {
          $set: { status: 'read' }
        }
      );

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
