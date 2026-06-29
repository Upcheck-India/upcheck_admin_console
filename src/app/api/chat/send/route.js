import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';
import { sendPushNotification } from '../../../../lib/pushNotifications';

export async function POST(request) {
  try {
    const { conversationId, body, clientId, replyToId, mediaUrl, isForwarded } = await request.json();
    
    if (!conversationId || (!body?.trim() && !mediaUrl)) {
      return NextResponse.json({ error: 'Conversation ID and message body (or mediaUrl) required' }, { status: 400 });
    }

    if (!ObjectId.isValid(conversationId)) {
      return NextResponse.json({ error: 'Invalid Conversation ID' }, { status: 400 });
    }

    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    // Verify conversation and connection
    const conversation = await db.collection('conversations').findOne({ 
      _id: new ObjectId(conversationId),
      participants: currentUser._id.toString()
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const recipientId = conversation.participants.find(p => p !== currentUser._id.toString());
    const botId = "600000000000000000000001";

    if (recipientId === botId) {
      if (conversation.isBotProcessing) {
        return NextResponse.json({ error: 'Please wait. I am currently busy processing another task.' }, { status: 409 });
      }
      const lockRes = await db.collection('conversations').updateOne(
        { _id: conversation._id, isBotProcessing: { $ne: true } },
        { $set: { isBotProcessing: true } }
      );
      if (lockRes.modifiedCount === 0) {
        return NextResponse.json({ error: 'Please wait. I am currently busy processing another task.' }, { status: 409 });
      }
    } else {
      // Check connection status
      const connection = await db.collection('chat_connections').findOne({
        userId: currentUser._id.toString(),
        peerId: recipientId,
        status: 'accepted'
      });

      if (!connection) {
        return NextResponse.json({ error: 'Connection not accepted' }, { status: 403 });
      }
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

    const messageType = body?.trim() ? 'text' : 'image';

    const message = {
      _id: messageId,
      conversationId,
      senderId: currentUser._id.toString(),
      recipientId,
      body: body?.trim() || '',
      type: messageType,
      ...(mediaUrl ? { mediaUrl } : {}),
      status: 'sent',
      createdAt: now,
      clientId: clientId || null,
      replyTo: replyToId || null,
      isForwarded: isForwarded || false
    };

    await db.collection('chat_messages').insertOne(message);

    if (mediaUrl) {
      const mediaIdMatch = mediaUrl.match(/\/api\/chat\/media\/([0-9a-fA-F]{24})/);
      if (mediaIdMatch && mediaIdMatch[1]) {
        await db.collection('chat_media.files').updateOne(
          { _id: new ObjectId(mediaIdMatch[1]) },
          { $inc: { 'metadata.refs': 1 } }
        );
      }
    }

    // Update conversation last message time
    await db.collection('conversations').updateOne(
      { _id: new ObjectId(conversationId) },
      { $set: { lastMessageAt: now } }
    );

    // Check if recipient has muted this DM chat
    const recipientMute = await db.collection('chat_mutes').findOne({
      userId: recipientId,
      chatId: conversationId,
      chatType: 'dm'
    });

    const isRecipientMuted = recipientMute && (
      recipientMute.isForever || (recipientMute.mutedUntil && new Date(recipientMute.mutedUntil) > new Date())
    );

    if (recipientId === botId) {
      import('../../../../lib/botAgent.js').then(({ triggerBotAgent }) => {
        triggerBotAgent({
          chatType: 'dm',
          chatId: conversationId,
          body: body?.trim() || '',
          currentUser,
          db
        }).catch(e => console.error('Bot Agent execution error:', e));
      });
    } else if (!isRecipientMuted) {
      // Send push notification to recipient
      await sendPushNotification(
        recipientId,
        `New message from ${currentUser.username || 'Someone'}`,
        body?.trim() || '📷 Image',
        { type: 'chat_message', conversationId }
      );
    }

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
