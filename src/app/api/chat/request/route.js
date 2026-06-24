import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';
import { sendPushNotification } from '../../../../lib/pushNotifications';

export async function POST(request) {
  try {
    const { peerId } = await request.json();
    
    if (!peerId) {
      return NextResponse.json({ error: 'Peer ID required' }, { status: 400 });
    }

    if (!ObjectId.isValid(peerId)) {
      return NextResponse.json({ error: 'Invalid Peer ID' }, { status: 400 });
    }

    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    const peerUser = await db.collection('admin_users').findOne({ _id: new ObjectId(peerId) });
    if (!peerUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check existing connection docs from both perspectives
    const myId = currentUser._id.toString();
    const myDoc = await db.collection('chat_connections').findOne({ userId: myId, peerId });
    const theirDoc = await db.collection('chat_connections').findOne({ userId: peerId, peerId: myId });

    // If either side has blocked, do not allow
    if ((myDoc && myDoc.status === 'blocked') || (theirDoc && theirDoc.status === 'blocked')) {
      return NextResponse.json({ error: 'Cannot send request' }, { status: 403 });
    }

    // If connection exists and is accepted or pending, return its conversation
    if (myDoc && (myDoc.status === 'accepted' || myDoc.status === 'pending')) {
      return NextResponse.json({
        success: true,
        conversationId: myDoc.conversationId,
        status: myDoc.status
      });
    }

    // If connection exists but revoked, move both to pending (re-request)
    if ((myDoc && myDoc.status === 'revoked') || (theirDoc && theirDoc.status === 'revoked')) {
      const now = new Date();
      let conversationId = myDoc?.conversationId || theirDoc?.conversationId;
      if (!conversationId) {
        const newConvId = new ObjectId();
        await db.collection('conversations').insertOne({
          _id: newConvId,
          participants: [myId, peerId],
          createdAt: now,
          lastMessageAt: null
        });
        conversationId = newConvId.toString();
      }

      await db.collection('chat_connections').updateOne(
        { userId: myId, peerId },
        {
          $set: { status: 'pending', initiatedBy: myId, updatedAt: now, conversationId },
          $setOnInsert: { createdAt: now }
        },
        { upsert: true }
      );

      await db.collection('chat_connections').updateOne(
        { userId: peerId, peerId: myId },
        {
          $set: { status: 'pending', initiatedBy: myId, updatedAt: now, conversationId },
          $setOnInsert: { createdAt: now }
        },
        { upsert: true }
      );

      // Send push notification to peerUser
      await sendPushNotification(
        peerId,
        'New Chat Request',
        `${currentUser.name || currentUser.username} sent you a connection request.`,
        { type: 'chat_request', conversationId: conversationId.toString() }
      );

      return NextResponse.json({ success: true, conversationId, status: 'pending' });
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

    // Create connections: both pending until receiver accepts
    await db.collection('chat_connections').insertOne({
      userId: currentUser._id.toString(),
      peerId: peerId,
      conversationId: conversationId.toString(),
      status: 'pending', // Requester is also pending until peer accepts
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

    // Send push notification to peerUser
    await sendPushNotification(
      peerId,
      'New Chat Request',
      `${currentUser.name || currentUser.username} sent you a connection request.`,
      { type: 'chat_request', conversationId: conversationId.toString() }
    );

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
