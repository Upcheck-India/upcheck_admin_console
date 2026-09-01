import clientPromise from './mongodb';

// Which device currently has which conversation open on screen.
//
// The mobile app reports this (lib/activeChatPresence.ts) so a push about a
// message the user is already looking at is never SENT, rather than sent and
// then suppressed on arrival. The client-side check in usePushNotifications.ts
// only gets a say while the JS runtime is foregrounded — pull down the shade,
// switch apps for a moment, or let Android hand the notification straight to
// the tray, and the notification is already posted before any JS runs.
//
// The app has been reporting into a 404 since the feature was written: this
// module and its route are the missing half.
//
// Keyed by push token, not by user: one person can have the app open on a
// phone and a tablet, and only the device actually showing the thread should
// go quiet. Records self-expire, so a device that is force-killed without
// clearing its record goes back to receiving notifications on its own.

const COLLECTION = 'chat_active_viewers';

// Must stay comfortably above the client's 45s heartbeat, so an open chat
// never lapses between beats, while still being short enough that a killed
// app starts notifying again quickly.
export const ACTIVE_CHAT_TTL_MS = 2 * 60 * 1000;

/**
 * The thread a push payload refers to, in the same form reportActiveChat()
 * sends. Returns null for anything that isn't a message about one specific
 * conversation (meetings, app store, announcements), which must always notify.
 */
export function threadKeyForData(data) {
  if (!data?.type) return null;
  // Status replies/reactions are ordinary DMs underneath (lib/status/dmBridge.js),
  // so being in that DM should silence them too.
  if (data.type === 'chat_message' || data.type === 'status_reply' || data.type === 'status_reaction') {
    return data.conversationId ? `dm:${data.conversationId}` : null;
  }
  if (data.type === 'team_message') return data.teamId ? `team:${data.teamId}` : null;
  if (data.type === 'group_message') return data.groupId ? `group:${data.groupId}` : null;
  return null;
}

export async function recordActiveChat({ token, userId, kind, id }) {
  const client = await clientPromise;
  const db = client.db('resources');
  if (!kind || !id) {
    await db.collection(COLLECTION).deleteOne({ _id: token });
    return;
  }
  await db.collection(COLLECTION).updateOne(
    { _id: token },
    {
      $set: {
        userId: String(userId),
        threadKey: `${kind}:${id}`,
        expiresAt: new Date(Date.now() + ACTIVE_CHAT_TTL_MS),
      },
    },
    { upsert: true },
  );
}

/**
 * Of `tokens`, those whose device is currently showing `threadKey`.
 *
 * Best-effort in the safe direction: if this query fails the caller gets an
 * empty set and everyone is notified. A redundant notification is a much
 * smaller failure than a silently missing one.
 */
export async function tokensViewingThread(db, tokens, threadKey) {
  if (!threadKey || !tokens?.length) return new Set();
  try {
    const rows = await db
      .collection(COLLECTION)
      .find(
        { _id: { $in: tokens }, threadKey, expiresAt: { $gt: new Date() } },
        { projection: { _id: 1 } },
      )
      .toArray();
    return new Set(rows.map((r) => r._id));
  } catch (err) {
    console.error('[activeChatViewers] lookup failed, notifying anyway:', err?.message || err);
    return new Set();
  }
}
