import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    // Ensure Bot user exists
    const botId = "600000000000000000000001";
    const botDetails = {
      _id: new ObjectId(botId),
      username: "upcheck_admin_bot",
      firstName: "Upcheck Admin",
      lastName: "Bot",
      name: "Upcheck Admin Bot",
      email: "upcheck_admin_bot@upcheck.in",
      role: "bot",
      avatar: "/api/media/6a420c78389ce06e791c5c61",
      messagingId: "upcheck_admin_bot",
      messagingPrivacy: "everyone",
      createdAt: new Date(),
    };
    await db.collection('admin_users').updateOne(
      { _id: new ObjectId(botId) },
      { $setOnInsert: botDetails },
      { upsert: true }
    );

    // Ensure connection with bot exists by default
    const botConnection = await db.collection('chat_connections').findOne({
      userId: currentUser._id.toString(),
      peerId: botId
    });

    if (!botConnection) {
      const conversationId = new ObjectId();
      await db.collection('conversations').insertOne({
        _id: conversationId,
        participants: [currentUser._id.toString(), botId],
        lastMessageAt: new Date(),
        createdAt: new Date(),
      });
      await db.collection('chat_connections').insertOne({
        userId: currentUser._id.toString(),
        peerId: botId,
        status: 'accepted',
        conversationId: conversationId.toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await db.collection('chat_connections').insertOne({
        userId: botId,
        peerId: currentUser._id.toString(),
        status: 'accepted',
        conversationId: conversationId.toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

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

    // Fetch active mutes
    const mutes = await db.collection('chat_mutes').find({
      userId: currentUser._id.toString(),
      chatType: 'dm'
    }).toArray();

    const muteMap = mutes.reduce((acc, m) => {
      const isMuted = m.isForever || (m.mutedUntil && new Date(m.mutedUntil) > new Date());
      if (isMuted) {
        acc[m.chatId] = m;
      }
      return acc;
    }, {});

    const enriched = connections.map(c => {
      const muteInfo = c.conversationId ? muteMap[c.conversationId] : null;
      return {
        ...c,
        _id: c._id?.toString(),
        peer: peerMap[c.peerId] ? {
          id: peerMap[c.peerId]._id.toString(),
          username: peerMap[c.peerId].username,
          name: peerMap[c.peerId].name,
          email: peerMap[c.peerId].email
        } : null,
        lastMessage: lastMessageMap[c.conversationId] || null,
        unreadCount: unreadMap[c.conversationId] || 0,
        isMuted: !!muteInfo,
        mutedUntil: muteInfo?.mutedUntil || null
      };
    });

    return NextResponse.json({ connections: enriched });
  } catch (err) {
    console.error('Connections error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
