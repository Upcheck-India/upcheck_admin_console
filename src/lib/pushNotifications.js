import clientPromise from './mongodb.js';
import { ObjectId } from 'mongodb';

// Falls back to these when a user hasn't picked a custom sound yet —
// matches the bundled asset filenames (without extension) registered via
// the expo-notifications config plugin's `sounds` array.
const DEFAULT_SOUND_KEY = { meetings: 'meeting_notif', messages: 'message_notif' };
export const SYSTEM_DEFAULT_SOUND_KEY = 'system_default';

// Which notification category a given `data.type` belongs to, for both
// channel routing and sound selection. Mirrors the client's own type
// conventions (meeting*, *_message/chat_message).
function categoryForType(type) {
  if (!type) return null;
  if (type.startsWith('meeting')) return 'meetings';
  if (type.endsWith('_message') || type === 'chat_message') return 'messages';
  return null;
}

// Android's notification sound is fixed to a channel at creation time and
// can't be changed after — so each (category, soundKey) combination a user
// might pick gets its own deterministic channel id, and the client ensures
// that channel actually exists locally before this could ever be targeted.
// iOS instead reads the `sound` field directly from the push payload.
function resolveNotificationRouting(user, type) {
  const category = categoryForType(type);
  if (!category) return { channelId: 'default', sound: 'default' };

  const soundKey = user?.notificationSounds?.[category] || DEFAULT_SOUND_KEY[category];
  if (soundKey === SYSTEM_DEFAULT_SOUND_KEY) {
    return { channelId: `${category}-${SYSTEM_DEFAULT_SOUND_KEY}`, sound: 'default' };
  }
  return { channelId: `${category}-${soundKey}`, sound: `${soundKey}.mp3` };
}

// Chat notifications get a "Reply" quick action (client registers a matching
// notification category with a text-input action under this id) so a
// message can be answered directly from the tray without opening the app.
function categoryIdForType(type) {
  if (type === 'chat_message' || type === 'team_message' || type === 'group_message') {
    return 'chat_reply';
  }
  return undefined;
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

    const { channelId, sound } = resolveNotificationRouting(user, data?.type);
    const categoryId = categoryIdForType(data?.type);
    const messages = tokens.map((token) => ({
      to: token,
      sound,
      priority: 'high',
      channelId,
      ...(categoryId ? { categoryId } : {}),
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

    // Each user may have picked a different sound, so routing is computed
    // per-user (not once globally) before flattening into the token list.
    const messages = users.flatMap(user => {
      const tokens = Array.from(new Set([
        ...(Array.isArray(user.expoPushTokens) ? user.expoPushTokens : []),
        ...(user.expoPushToken ? [user.expoPushToken] : []),
      ].filter(Boolean)));
      const { channelId, sound } = resolveNotificationRouting(user, data?.type);
      return tokens.map(token => ({
        to: token,
        sound,
        priority: 'high',
        channelId,
        title,
        body,
        data,
      }));
    });

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
