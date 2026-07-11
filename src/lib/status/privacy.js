import { ObjectId } from 'mongodb';

// Status privacy is a per-user DEFAULT that applies to all of that user's
// current/future status updates (same model as WhatsApp's status privacy —
// not a per-post setting). It only ever narrows the existing "your accepted
// connections" audience (see /api/status/feed) — it can never expand who
// can see your status beyond people you're already connected with, which
// keeps it consistent with reply/react already requiring a connection.

export const PRIVACY_MODES = [
  'everyone',
  'selected_teams',
  'selected_users',
  'everyone_except_users',
  'everyone_except_teams',
];

const COLLECTION = 'status_privacy';

const DEFAULT_PRIVACY = { mode: 'everyone', teamIds: [], userIds: [] };

export async function getStatusPrivacy(db, userId) {
  const doc = await db.collection(COLLECTION).findOne({ userId });
  if (!doc) return { userId, ...DEFAULT_PRIVACY };
  return {
    userId,
    mode: PRIVACY_MODES.includes(doc.mode) ? doc.mode : 'everyone',
    teamIds: Array.isArray(doc.teamIds) ? doc.teamIds : [],
    userIds: Array.isArray(doc.userIds) ? doc.userIds : [],
  };
}

export async function setStatusPrivacy(db, userId, { mode, teamIds, userIds }) {
  if (!PRIVACY_MODES.includes(mode)) {
    throw new Error(`Invalid privacy mode: ${mode}`);
  }

  let safeTeamIds = [];
  let safeUserIds = [];

  if (mode === 'selected_teams' || mode === 'everyone_except_teams') {
    const requested = Array.isArray(teamIds) ? teamIds.filter((id) => ObjectId.isValid(id)) : [];
    if (requested.length > 0) {
      // Re-validate against teams the user is ACTUALLY a member/lead of —
      // never trust arbitrary team IDs from the client. Matches the same
      // string-or-ObjectId storage ambiguity used everywhere else this
      // codebase queries team membership (see api/teams/route.js).
      const objectIds = requested.map((id) => new ObjectId(id));
      const myTeams = await db.collection('teams').find({
        _id: { $in: objectIds },
        $or: [
          { members: userId }, { lead: userId },
          { members: new ObjectId(userId) }, { lead: new ObjectId(userId) },
        ],
      }, { projection: { _id: 1 } }).toArray();
      safeTeamIds = myTeams.map((t) => t._id.toString());
    }
  }

  if (mode === 'selected_users' || mode === 'everyone_except_users') {
    const requested = Array.isArray(userIds) ? userIds.filter((id) => typeof id === 'string') : [];
    if (requested.length > 0) {
      // Re-validate against accepted connections only — same reasoning as
      // teams above.
      const myConnections = await db.collection('chat_connections').find({
        userId,
        peerId: { $in: requested },
        status: 'accepted',
      }, { projection: { peerId: 1 } }).toArray();
      safeUserIds = myConnections.map((c) => c.peerId);
    }
  }

  const next = { userId, mode, teamIds: safeTeamIds, userIds: safeUserIds, updatedAt: new Date() };
  await db.collection(COLLECTION).updateOne(
    { userId },
    { $set: next },
    { upsert: true }
  );
  return { userId, mode, teamIds: safeTeamIds, userIds: safeUserIds };
}

function normalizeIds(list) {
  return new Set((list || []).map((v) => v?.toString()).filter(Boolean));
}

async function fetchTeamMembership(db, teamIds) {
  const validIds = [...new Set(teamIds)].filter((id) => ObjectId.isValid(id));
  if (validIds.length === 0) return new Map();
  const teams = await db.collection('teams')
    .find({ _id: { $in: validIds.map((id) => new ObjectId(id)) } }, { projection: { members: 1, lead: 1 } })
    .toArray();
  const map = new Map();
  for (const team of teams) {
    const members = normalizeIds(team.members);
    if (team.lead) members.add(team.lead.toString());
    map.set(team._id.toString(), members);
  }
  return map;
}

// Batch check used by the feed route: given a viewer and a list of
// candidate status owners (the viewer's connections), returns the subset
// the viewer is actually allowed to see per each owner's own privacy
// setting.
export async function filterOwnersVisibleTo(db, viewerId, ownerIds) {
  if (!ownerIds || ownerIds.length === 0) return [];

  const privacyDocs = await db.collection(COLLECTION)
    .find({ userId: { $in: ownerIds } })
    .toArray();
  const privacyMap = new Map(privacyDocs.map((d) => [d.userId, d]));

  const allTeamIds = new Set();
  for (const ownerId of ownerIds) {
    const p = privacyMap.get(ownerId);
    if (p && (p.mode === 'selected_teams' || p.mode === 'everyone_except_teams')) {
      (p.teamIds || []).forEach((t) => allTeamIds.add(t));
    }
  }
  const teamMembership = await fetchTeamMembership(db, [...allTeamIds]);
  const viewerInAnyTeam = (teamIds) => (teamIds || []).some((t) => teamMembership.get(t)?.has(viewerId));

  return ownerIds.filter((ownerId) => {
    if (ownerId === viewerId) return true;
    const p = privacyMap.get(ownerId);
    if (!p || !PRIVACY_MODES.includes(p.mode) || p.mode === 'everyone') return true;
    switch (p.mode) {
      case 'selected_users':
        return (p.userIds || []).includes(viewerId);
      case 'everyone_except_users':
        return !(p.userIds || []).includes(viewerId);
      case 'selected_teams':
        return viewerInAnyTeam(p.teamIds);
      case 'everyone_except_teams':
        return !viewerInAnyTeam(p.teamIds);
      default:
        return true;
    }
  });
}

// Single-pair check for defense in depth on view/react/reply — a status ID
// leaking (or being guessed) shouldn't let someone bypass the feed-level
// filter just because they know it.
export async function canViewerSeeOwnersStatus(db, ownerId, viewerId) {
  if (ownerId === viewerId) return true;
  const visible = await filterOwnersVisibleTo(db, viewerId, [ownerId]);
  return visible.includes(ownerId);
}
