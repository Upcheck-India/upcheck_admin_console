import clientPromise from './mongodb.js';
import { threadKeyForData, tokensViewingThread } from './activeChatViewers';
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
  // status_reply/status_reaction are DM messages under the hood (see
  // lib/status/dmBridge.js) and should sound/route exactly like one.
  if (type.endsWith('_message') || type === 'chat_message' || type.startsWith('status_')) return 'message';
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
// Android replaces an already-displayed notification carrying the same `tag`,
// and `collapseId` coalesces messages still in transit. Keying both on the
// conversation is what turns "thirty buzzes from one busy group" into a single
// notification that updates in place — the behaviour people expect from every
// other messenger. Non-chat notifications get no tag, so a meeting reminder
// never replaces an unrelated one.
// A busy group should not buzz once per message.
//
// `tag` above already collapses the notifications visually, so the user sees
// one entry per conversation rather than thirty. This handles the other half:
// within the quiet window, the replacement is delivered SILENTLY. The content
// still updates instantly and nothing is lost — only the sound and vibration
// are suppressed, and only for a conversation that just made a noise.
//
// Direct messages are exempt: a DM is a person talking to you specifically,
// and the flood problem is a group-chat problem. A mention is exempt for the
// same reason.
const QUIET_WINDOW_MS = 45 * 1000;
const THROTTLE_COLLECTION = 'chat_push_throttle';

function isFloodProne(data) {
  return data?.type === 'team_message' || data?.type === 'group_message';
}

/**
 * Of the given {userId, threadKey} pairs, those that made a sound recently.
 * Marks all of them as having just notified.
 *
 * Fails open: on any error nothing is considered recent, so every notification
 * keeps its sound. Being noisy is a far better failure than being silent.
 */
async function claimQuietWindow(db, pairs) {
  if (!pairs.length) return new Set();
  const ids = pairs.map((p) => `${p.userId}|${p.threadKey}`);
  try {
    const now = new Date();
    const recent = await db
      .collection(THROTTLE_COLLECTION)
      .find({ _id: { $in: ids }, expiresAt: { $gt: now } }, { projection: { _id: 1 } })
      .toArray();
    const quiet = new Set(recent.map((r) => r._id));
    await db.collection(THROTTLE_COLLECTION).bulkWrite(
      ids.map((_id) => ({
        updateOne: {
          filter: { _id },
          update: { $set: { expiresAt: new Date(now.getTime() + QUIET_WINDOW_MS) } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    return quiet;
  } catch (err) {
    console.error('[Push] quiet-window check failed, notifying with sound:', err?.message || err);
    return new Set();
  }
}

function collapseKeyForData(data) {
  return threadKeyForData(data) || undefined;
}

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

    // Drop any device that currently has this exact conversation open. The
    // user is already looking at the message; notifying them about it is the
    // complaint this whole mechanism exists to fix. This filters tokens rather
    // than returning early, so the user's OTHER devices still get notified.
    const viewing = await tokensViewingThread(db, tokens, threadKeyForData(data));
    const deliverTo = tokens.filter((t) => !viewing.has(t));
    if (deliverTo.length === 0) {
      console.log(
        `[Push Notification] every device of ${userId} has this thread open; not sending`
      );
      return;
    }

    const { channelId, sound } = resolveNotificationRouting(user, data?.type);
    const categoryId = categoryIdForType(data?.type);
    // Tag the payload with its intended recipient so the client can refuse
    // to surface it if a different account is logged in on this device by
    // the time it arrives (a stale/shared token from a previous logout).
    const dataWithRecipient = { ...data, recipientUserId: user._id.toString() };
    const collapseKey = collapseKeyForData(data);
    const messages = deliverTo.map((token) => ({
      to: token,
      sound,
      priority: 'high',
      channelId,
      ...(categoryId ? { categoryId } : {}),
      ...(collapseKey ? { tag: collapseKey, collapseId: collapseKey } : {}),
      title,
      body,
      data: dataWithRecipient,
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
        if (ticket.details?.error === 'DeviceNotRegistered' && deliverTo[i]) {
          await removeStaleToken(db, userId, deliverTo[i]);
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

    // Devices with one of these threads already open, resolved in ONE query
    // for the whole batch rather than per recipient. Team and group fan-out
    // comes through here, so without this a member reading a busy group is
    // notified about every message they are actively watching arrive.
    const allTokens = [];
    for (const u of users) {
      if (Array.isArray(u.expoPushTokens)) allTokens.push(...u.expoPushTokens);
      if (u.expoPushToken) allTokens.push(u.expoPushToken);
    }
    const threadKeys = [...new Set(items.map((i) => threadKeyForData(i.data)).filter(Boolean))];
    const viewingByThread = new Map();
    for (const key of threadKeys) {
      viewingByThread.set(key, await tokensViewingThread(db, [...new Set(allTokens)], key));
    }

    // One round trip for the whole fan-out, not one per recipient.
    const quietCandidates = items
      .filter((i) => isFloodProne(i.data) && !i.data?.isMention)
      .map((i) => ({ userId: i.userId, threadKey: threadKeyForData(i.data) }))
      .filter((p) => p.threadKey);
    const quiet = await claimQuietWindow(db, quietCandidates);

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
      const dataWithRecipient = { ...(item.data || {}), recipientUserId: user._id.toString() };
      const itemThreadKey = threadKeyForData(item.data);
      // A silent replacement: the tray entry updates, the phone stays quiet.
      const isQuiet = quiet.has(`${item.userId}|${itemThreadKey}`);
      const viewing = viewingByThread.get(itemThreadKey) || new Set();
      for (const token of tokens) {
        if (viewing.has(token)) continue; // that device is reading this thread right now
        messages.push({
          to: token,
          sound: isQuiet ? null : sound,
          priority: 'high',
          channelId,
          ...(categoryId ? { categoryId } : {}),
          ...(itemThreadKey ? { tag: itemThreadKey, collapseId: itemThreadKey } : {}),
          title: item.title,
          body: item.body,
          data: dataWithRecipient,
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
