import clientPromise from './mongodb.js';
import { ObjectId } from 'mongodb';

// Two different namespaces that look similar but must not be conflated:
// - preference storage keys are singular ('meeting' / 'message') — matches
//   what the client saves via POST /api/auth/notification-prefs and reads
//   via user.notificationSounds.<category>.
// - Android channel-id prefixes are plural ('meetings' / 'messages') —
//   matches the channel ids the client actually creates on-device (a
//   pre-existing convention from before per-sound channels existed).
// Previously this file used the plural form for BOTH, so the preference
// lookup (user.notificationSounds.meetings) always missed the real field
// (notificationSounds.meeting) and silently fell back to the default sound
// no matter what the user had picked.
const DEFAULT_SOUND_KEY = { meeting: 'meeting_notif', message: 'message_notif' };
const CHANNEL_PREFIX = { meeting: 'meetings', message: 'messages' };
export const SYSTEM_DEFAULT_SOUND_KEY = 'system_default';

// Which notification category a given `data.type` belongs to, for both
// channel routing and sound selection. Mirrors the client's own type
// conventions (meeting*, *_message/chat_message).
function categoryForType(type) {
  if (!type) return null;
  if (type.startsWith('meeting')) return 'meeting';
  if (type.endsWith('_message') || type === 'chat_message') return 'message';
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
  const channelPrefix = CHANNEL_PREFIX[category];
  if (soundKey === SYSTEM_DEFAULT_SOUND_KEY) {
    return { channelId: `${channelPrefix}-${SYSTEM_DEFAULT_SOUND_KEY}`, sound: 'default' };
  }
  return { channelId: `${channelPrefix}-${soundKey}`, sound: `${soundKey}.mp3` };
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
 * Sends push notifications to multiple recipients in one batch, instead of
 * one sendPushNotification() call per recipient. Team/group chat message
 * fan-out (a message to N members) used to do exactly that — N separate
 * admin_users lookups and N separate fetch() calls to Expo, all in a tight
 * loop — which is real, avoidable load even though it was fire-and-forget
 * (never blocked the message-send response). One user lookup query plus
 * Expo's own recommended <=100-per-request batching instead.
 *
 * @param {Array<{userId: string, title: string, body: string, data?: object}>} items
 *   Per-recipient title/body/data, since e.g. a team message's push copy
 *   differs for a mentioned recipient vs everyone else.
 */
export async function sendPushNotificationsBatch(items) {
  try {
    if (!items || items.length === 0) return;
    const client = await clientPromise;
    const db = client.db('resources');

    const userIds = [...new Set(items.map((i) => i.userId))];
    const objIds = userIds.map((id) => {
      try { return new ObjectId(id); } catch { return id; }
    });
    const users = await db.collection('admin_users').find({ _id: { $in: objIds } }).toArray();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const messages = [];
    const tokenOwners = []; // parallel to `messages`, for stale-token cleanup below
    for (const item of items) {
      const user = userMap.get(item.userId);
      if (!user) continue;
      const tokens = Array.from(new Set([
        ...(Array.isArray(user.expoPushTokens) ? user.expoPushTokens : []),
        ...(user.expoPushToken ? [user.expoPushToken] : []),
      ].filter(Boolean)));
      if (tokens.length === 0) continue;

      const { channelId, sound } = resolveNotificationRouting(user, item.data?.type);
      const categoryId = categoryIdForType(item.data?.type);
      for (const token of tokens) {
        messages.push({
          to: token,
          sound,
          priority: 'high',
          channelId,
          ...(categoryId ? { categoryId } : {}),
          title: item.title,
          body: item.body,
          data: item.data || {},
        });
        tokenOwners.push({ userId: item.userId, token });
      }
    }
    if (messages.length === 0) return;

    // Expo push notifications endpoint allows batching up to 100 messages per request
    const chunkSize = 100;
    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      const chunkOwners = tokenOwners.slice(i, i + chunkSize);
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      const receipt = await response.json();
      const tickets = Array.isArray(receipt?.data) ? receipt.data : [receipt?.data].filter(Boolean);
      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        if (ticket?.status === 'error') {
          console.error('[Push Notification Batch Error from Expo]', ticket);
          if (ticket.details?.error === 'DeviceNotRegistered' && chunkOwners[j]) {
            await removeStaleToken(db, chunkOwners[j].userId, chunkOwners[j].token);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Push Notification Batch Error]', error);
  }
}

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
