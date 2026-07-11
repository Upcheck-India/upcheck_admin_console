import { ObjectId } from 'mongodb';
import { sendPushNotification } from '../pushNotifications.js';

// Replies/reactions to a status are deliberately implemented as ordinary DM
// messages (with an extra statusContext field) instead of a parallel
// notification system — this way they get realtime delivery, the inbox
// preview, and push notifications for free from the existing chat_messages
// pipeline (change streams / poll / push all already watch this collection).
// Mirrors chat/send/route.js's message-creation shape minus bot/slash-command/
// forwarding concerns, which don't apply here.
export async function sendStatusLinkedMessage({ db, senderUser, recipientId, body, statusContext }) {
  const senderId = senderUser._id.toString();
  if (senderId === recipientId) return null; // can't message yourself

  const connection = await db.collection('chat_connections').findOne({
    userId: senderId,
    peerId: recipientId,
    status: 'accepted',
  });
  if (!connection?.conversationId) {
    throw new Error('No conversation exists between these users');
  }

  const now = new Date();
  const messageId = new ObjectId();
  const message = {
    _id: messageId,
    conversationId: connection.conversationId,
    senderId,
    recipientId,
    body,
    type: 'text',
    status: 'sent',
    createdAt: now,
    clientId: null,
    replyTo: null,
    isForwarded: false,
    statusContext,
  };

  await db.collection('chat_messages').insertOne(message);
  await db.collection('conversations').updateOne(
    { _id: new ObjectId(connection.conversationId) },
    { $set: { lastMessageAt: now } }
  );

  const recipientMute = await db.collection('chat_mutes').findOne({
    userId: recipientId,
    chatId: connection.conversationId,
    chatType: 'dm',
  });
  const isRecipientMuted = recipientMute && (
    recipientMute.isForever || (recipientMute.mutedUntil && new Date(recipientMute.mutedUntil) > new Date())
  );

  if (!isRecipientMuted) {
    const pushType = statusContext.kind === 'reaction' ? 'status_reaction' : 'status_reply';
    sendPushNotification(
      recipientId,
      `${senderUser.username || 'Someone'} ${statusContext.kind === 'reaction' ? 'reacted to' : 'replied to'} your status`,
      body,
      { type: pushType, conversationId: connection.conversationId, messageId: messageId.toString(), statusId: statusContext.statusId }
    ).catch(err => console.error('Status push notification error:', err));
  }

  return { ...message, _id: messageId.toString() };
}
