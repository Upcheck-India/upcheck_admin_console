// "Renamed the group", "Only admins can send messages now" — the small notices
// that sit centred in a chat, attributed to nobody.
//
// They are ordinary rows in the same messages collection rather than a separate
// stream, because everything that already works for messages then works for
// these for free: ordering, pagination, the realtime change stream, the
// unread-preview text. The only thing that must NOT treat them as messages is
// push notification — a group being renamed should never buzz twenty phones.

const COLLECTION = { group: 'group_chat_messages', team: 'team_messages' };
const ID_FIELD = { group: 'groupId', team: 'teamId' };

/** How a posting policy reads to a person. */
export const POSTING_POLICIES = ['everyone', 'admins'];
export function normalizePostingPolicy(value, fallback = 'everyone') {
  return POSTING_POLICIES.includes(value) ? value : fallback;
}

// Who may see the NAMES behind a reaction. The counts and emoji are always
// visible to everyone — hiding those would make reactions meaningless. This
// only governs "who reacted", which in a workplace chat is the part people
// actually care about being private.
//
//   everyone — anyone in the chat can see who reacted (the default, and how
//              this behaved before the setting existed)
//   sender   — only the author of the message, plus admins
//   admins   — only admins
export const REACTION_VISIBILITIES = ['everyone', 'sender', 'admins'];
export function normalizeReactionVisibility(value, fallback = 'everyone') {
  return REACTION_VISIBILITIES.includes(value) ? value : fallback;
}

/**
 * May this viewer see who reacted to this message?
 * Fails closed on an unknown value only in the sense of falling back to the
 * configured default, which is 'everyone' — the pre-existing behaviour.
 */
export function canSeeReactors(visibility, { isAdmin, isMessageAuthor }) {
  switch (normalizeReactionVisibility(visibility)) {
    case 'admins':
      return !!isAdmin;
    case 'sender':
      return !!isAdmin || !!isMessageAuthor;
    default:
      return true;
  }
}

/**
 * Strip the identities out of a message's reactions when the viewer is not
 * allowed to see them.
 *
 * Done on the SERVER, not by hiding a list in the UI: the names are in the API
 * response either way, so a client-side check protects nothing from anyone who
 * opens the network tab. The emoji and the count survive — those are the
 * reaction; only "who" is privileged.
 */
export function redactReactions(reactions, visibility, { isAdmin, isMessageAuthor }) {
  if (!Array.isArray(reactions) || reactions.length === 0) return reactions || [];
  if (canSeeReactors(visibility, { isAdmin, isMessageAuthor })) return reactions;
  return reactions.map((r) => ({ emoji: r.emoji, createdAt: r.createdAt, hidden: true }));
}

/**
 * Append a system notice to a group or team chat. Never throws: a settings
 * change must not fail because its announcement could not be written.
 *
 * `senderId: null` is what marks it — the client renders any message with no
 * sender as a centred notice, so no schema migration is needed for the
 * messages already in these collections.
 */
export async function postSystemMessage(db, kind, chatId, text) {
  const collection = COLLECTION[kind];
  if (!collection || !chatId || !text) return null;
  try {
    const doc = {
      [ID_FIELD[kind]]: String(chatId),
      senderId: null,
      body: text,
      type: 'system',
      clientId: null,
      createdAt: new Date(),
      // Nobody needs to "read" a notice — an empty readBy would make it count
      // as unread for everyone and light up every badge.
      readBy: [],
      deletedFor: [],
      deletedForEveryone: false,
      replyToId: null,
      replyToBody: null,
      replyToName: null,
      isForwarded: false,
      isSystem: true,
    };
    const res = await db.collection(collection).insertOne(doc);
    return { ...doc, _id: res.insertedId };
  } catch (err) {
    console.error(`[systemMessage] could not post to ${kind} ${chatId}:`, err?.message || err);
    return null;
  }
}

/**
 * Describe what actually changed, as one notice per change.
 *
 * Only genuine differences produce a line — saving the settings form without
 * touching anything should not announce that nothing happened, which is what
 * makes a change log worth reading.
 */
export function describeChanges(before, after, actorName) {
  const who = actorName || 'An admin';
  const lines = [];

  const trim = (v) => (typeof v === 'string' ? v.trim() : v);

  if (trim(after.name) && trim(after.name) !== trim(before.name)) {
    lines.push(`${who} changed the name to "${trim(after.name)}"`);
  }

  if (after.description !== undefined && trim(after.description) !== trim(before.description || '')) {
    lines.push(
      trim(after.description)
        ? `${who} updated the description`
        : `${who} removed the description`,
    );
  }

  if (after.avatar !== undefined && after.avatar !== before.avatar) {
    lines.push(after.avatar ? `${who} changed the group photo` : `${who} removed the group photo`);
  }

  const beforePolicy = normalizePostingPolicy(before.postingPolicy);
  const afterPolicy = normalizePostingPolicy(after.postingPolicy, beforePolicy);
  if (afterPolicy !== beforePolicy) {
    lines.push(
      afterPolicy === 'admins'
        ? `${who} restricted sending messages to admins`
        : `${who} allowed everyone to send messages`,
    );
  }

  const beforeReactions = normalizeReactionVisibility(before.reactionVisibility);
  const afterReactions = normalizeReactionVisibility(after.reactionVisibility, beforeReactions);
  if (afterReactions !== beforeReactions) {
    const wording = {
      everyone: 'everyone can see who reacted',
      sender: 'only the message author and admins can see who reacted',
      admins: 'only admins can see who reacted',
    };
    lines.push(`${who} changed reaction privacy: ${wording[afterReactions]}`);
  }

  // Membership is summarised as counts rather than named, so a bulk edit does
  // not paste thirty names into the conversation.
  const idsOf = (list) => new Set((list || []).map((v) => String(v)));
  if (after.members !== undefined) {
    const wasIn = idsOf(before.members);
    const nowIn = idsOf(after.members);
    const added = [...nowIn].filter((id) => !wasIn.has(id)).length;
    const removed = [...wasIn].filter((id) => !nowIn.has(id)).length;
    if (added) lines.push(`${who} added ${added} ${added === 1 ? 'member' : 'members'}`);
    if (removed) lines.push(`${who} removed ${removed} ${removed === 1 ? 'member' : 'members'}`);
  }

  return lines;
}
