import clientPromise from './mongodb.js';
import { ObjectId } from 'mongodb';

// Android notification channel to route this push to. The client creates
// dedicated channels ('messages' vs 'meetings') so that a burst of meeting
// notifications can no longer collapse/throttle messaging notifications (and
// vice versa) the way they did when everything shared the single 'default'
// channel.
function channelIdForType(type) {
  if (!type) return 'default';
  if (type.startsWith('meeting')) return 'meetings';
  if (type.endsWith('_message') || type === 'chat_message') return 'messages';
  return 'default';
}

async function removeStaleToken(db, userId, token) {
  await db.collection('admin_users').updateOne(
    { _id: new ObjectId(userId) },
    {
      $pull: { expoPushTokens: token },
      $unset: { expoPushToken: '' },
    }
  );
}

/**
 * Sends an Expo push notification to a specific user.
 *
 * @param {string | ObjectId} userId - The target user's ID
 * @param {string} title - The notification title
 * @param {string} body - The notification body text
 * @param {object} data - Optional extra data payload
 */
export async function sendPushNotification(userId, title, body, data = {}) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ _id: new ObjectId(userId) });

    // Support both the legacy single-token field and the new multi-device
    // token array so every logged-in device for this user gets notified,
    // instead of only whichever device registered its token last.
    const tokens = Array.from(new Set([
      ...(Array.isArray(user?.expoPushTokens) ? user.expoPushTokens : []),
      ...(user?.expoPushToken ? [user.expoPushToken] : []),
    ].filter(Boolean)));

    if (!user || tokens.length === 0) {
      console.log(`[Push Notification] No push token for user ${userId}`);
      return;
    }

    const channelId = channelIdForType(data?.type);
    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      priority: 'high',
      channelId,
      title,
      body,
      data,
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const receipt = await response.json();
    const tickets = Array.isArray(receipt?.data) ? receipt.data : [receipt?.data].filter(Boolean);
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket?.status === 'error') {
        console.error('[Push Notification Error from Expo]', ticket);
        // Stop re-sending to tokens Expo/the OS has permanently rejected,
        // so a stale token from an uninstalled app doesn't keep silently
        // eating this user's notification for good.
        if (ticket.details?.error === 'DeviceNotRegistered' && tokens[i]) {
          await removeStaleToken(db, userId, tokens[i]);
        }
      }
    }
    console.log('[Push Notification] Sent:', receipt);
  } catch (error) {
    console.error('[Push Notification Error]', error);
  }
}

/**
 * Helper to send notifications to an entire team (except sender)
 * (Actually, we handled team push logic inside the team-chat POST route,
 * so we can just export this for future use or omit it. Since I already 
 * implemented the team iteration in the route, I'll just leave this as is
 * but ensure exports are clean.)
 */

/**
 * Sends an Expo push notification to all registered users.
 * 
 * @param {string} title - The notification title
 * @param {string} body - The notification body text
 * @param {object} data - Optional extra data payload
 */
export async function sendPushNotificationToAll(title, body, data = {}) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');
    // Fetch all users with active push tokens
    const users = await db.collection('admin_users').find({
      $or: [
        { expoPushToken: { $exists: true, $ne: null, $regex: /^ExponentPushToken/ } },
        { expoPushTokens: { $exists: true, $not: { $size: 0 } } },
      ],
    }).toArray();

    if (users.length === 0) {
      console.log('[Push Notification All] No users with push tokens found');
      return;
    }

    const channelId = channelIdForType(data?.type);
    const allTokens = users.flatMap(user => Array.from(new Set([
      ...(Array.isArray(user.expoPushTokens) ? user.expoPushTokens : []),
      ...(user.expoPushToken ? [user.expoPushToken] : []),
    ].filter(Boolean))));

    const messages = allTokens.map(token => ({
      to: token,
      sound: 'default',
      priority: 'high',
      channelId,
      title,
      body,
      data,
    }));

    // Expo push notifications endpoint allows batching up to 100 messages per request
    const chunkSize = 100;
    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const receipt = await response.json();
      console.log(`[Push Notification All] Sent chunk to ${chunk.length} users:`, receipt);
    }
  } catch (error) {
    console.error('[Push Notification All Error]', error);
  }
}
