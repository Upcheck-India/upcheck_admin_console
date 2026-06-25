import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    // Get all connections for current user
    const connections = await db.collection('chat_connections')
      .find({ userId: currentUser._id.toString() })
      .sort({ updatedAt: -1 })
      .toArray();

    // Get peer user details
    const peerIds = connections.map(c => new ObjectId(c.peerId));
    const peers = await db.collection('admin_users')
      .find(
        { _id: { $in: peerIds } },
        { projection: { _id: 1, username: 1, name: 1, email: 1 } }
      )
      .toArray();

    const peerMap = peers.reduce((acc, p) => {
      acc[p._id.toString()] = p;
      return acc;
    }, {});

    // Get last message for each conversation
    const conversationIds = connections
      .filter(c => c.conversationId)
      .map(c => c.conversationId);

    const lastMessages = await db.collection('chat_messages')
      .aggregate([
        { $match: { 
          conversationId: { $in: conversationIds },
          deletedFor: { $ne: currentUser._id.toString() }
        } },
        { $sort: { createdAt: -1 } },
        { $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' }
        }}
      ])
      .toArray();

    const lastMessageMap = lastMessages.reduce((acc, lm) => {
      acc[lm._id] = lm.lastMessage;
      return acc;
    }, {});

    // Get unread counts
    const unreadCounts = await db.collection('chat_messages')
      .aggregate([
        {
          $match: {
            conversationId: { $in: conversationIds },
            recipientId: currentUser._id.toString(),
            status: { $nin: ['read'] }
          }
        },
        {
          $group: {
            _id: '$conversationId',
            count: { $sum: 1 }
          }
        }
      ])
      .toArray();

    const unreadMap = unreadCounts.reduce((acc, u) => {
      acc[u._id] = u.count;
      return acc;
    }, {});

    const enriched = connections.map(c => ({
      ...c,
      _id: c._id?.toString(),
      peer: peerMap[c.peerId] ? {
        id: peerMap[c.peerId]._id.toString(),
        username: peerMap[c.peerId].username,
        name: peerMap[c.peerId].name,
        email: peerMap[c.peerId].email
      } : null,
      lastMessage: lastMessageMap[c.conversationId] || null,
      unreadCount: unreadMap[c.conversationId] || 0
    }));

    return NextResponse.json({ connections: enriched });
  } catch (err) {
    console.error('Connections error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
