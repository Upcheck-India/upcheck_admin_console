import { ObjectId } from 'mongodb';
import { isGroupAdmin } from '../groupPermissions';

export function isPlatformAdmin(user) {
  return user?.role === 'Admin' || user?.role === 'Console admin';
}

/**
 * Who may install/uninstall plugins for a given chat:
 * - DM: either participant (no hierarchy in a 1:1 chat)
 * - Team: the team lead, or a platform Admin/Console admin
 * - Group: a group admin, or a platform Admin/Console admin
 */
export async function canManagePluginsForChat(db, user, chatType, chatId) {
  if (isPlatformAdmin(user)) return true;

  if (chatType === 'dm') {
    if (!ObjectId.isValid(chatId)) return false;
    const conversation = await db.collection('conversations').findOne({
      _id: new ObjectId(chatId),
      participants: user._id.toString(),
    });
    return !!conversation;
  }

  if (chatType === 'team') {
    if (!ObjectId.isValid(chatId)) return false;
    const team = await db.collection('teams').findOne({ _id: new ObjectId(chatId) });
    return !!team && team.lead?.toString() === user._id.toString();
  }

  if (chatType === 'group') {
    if (!ObjectId.isValid(chatId)) return false;
    const group = await db.collection('group_chats').findOne({ _id: new ObjectId(chatId) });
    return !!group && isGroupAdmin(group, user._id.toString());
  }

  return false;
}

/** Whether `user` is a participant of the given chat at all (used to gate
 * read-only access like "what plugins are installed here"). */
export async function isChatParticipant(db, user, chatType, chatId) {
  if (isPlatformAdmin(user)) return true;
  if (!ObjectId.isValid(chatId)) return false;
  const userId = user._id.toString();

  if (chatType === 'dm') {
    const conversation = await db.collection('conversations').findOne({ _id: new ObjectId(chatId), participants: userId });
    return !!conversation;
  }
  if (chatType === 'team') {
    const team = await db.collection('teams').findOne({
      _id: new ObjectId(chatId),
      $or: [{ members: userId }, { lead: userId }, { members: user._id }, { lead: user._id }],
    });
    return !!team;
  }
  if (chatType === 'group') {
    const group = await db.collection('group_chats').findOne({ _id: new ObjectId(chatId) });
    if (!group) return false;
    if ((group.members || []).some(m => m.toString() === userId)) return true;
    const teamIds = (group.teams || []).map(t => new ObjectId(t));
    if (teamIds.length === 0) return false;
    const teams = await db.collection('teams').find({ _id: { $in: teamIds } }).toArray();
    const excluded = (group.excludedMembers || []).some(m => m.toString() === userId);
    if (excluded) return false;
    return teams.some(t => (t.members || []).some(m => m.toString() === userId) || t.lead?.toString() === userId);
  }
  return false;
}

/**
 * Whether `caller` may view `targetUserId`'s task/project data via a slash
 * command. Mirrors the existing bot-agent permission model: you can always
 * see your own data; to see someone else's you need to be a platform admin
 * or share a team with them.
 */
export async function canViewUserData(db, caller, targetUserId) {
  const callerId = caller._id.toString();
  if (callerId === targetUserId) return true;
  if (isPlatformAdmin(caller)) return true;

  const sharedTeam = await db.collection('teams').findOne({
    $and: [
      { $or: [{ members: callerId }, { lead: callerId }, { members: caller._id }, { lead: caller._id }] },
      { $or: [{ members: targetUserId }, { lead: targetUserId }] },
    ],
  });
  return !!sharedTeam;
}
