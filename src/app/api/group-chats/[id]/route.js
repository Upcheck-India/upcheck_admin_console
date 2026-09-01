import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { isGroupAdmin, canManageGroup } from '../../../../lib/groupPermissions';
import {
  describeChanges,
  normalizePostingPolicy,
  normalizeReactionVisibility,
  postSystemMessage,
} from '../../../../lib/chatSystemMessages';

// The notices name who made the change, so they need a human label rather than
// a username where a real name exists.
function displayNameOf(u) {
  if (!u) return 'An admin';
  const full = [u.firstName, u.lastName].map((p) => (p || '').trim()).filter(Boolean).join(' ');
  return full || u.name || u.username || 'An admin';
}

async function getAuthUser(req) {
  const authHeader = req.headers.get('authorization');
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const cookieStore = cookies();
    token = cookieStore.get('admin_token')?.value;
  }
  if (!token) return null;
  const client = await clientPromise;
  const db = client.db('resources');
  return await db.collection('admin_users').findOne({ sessionToken: token });
}

export async function GET(req, { params }) {
  try {
    const groupId = params.id;
    if (!ObjectId.isValid(groupId)) {
      return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { db } = { db: (await clientPromise).db('resources') };
    const userId = authUser._id.toString();

    const group = await db.collection('group_chats').findOne({ _id: new ObjectId(groupId) });
    if (!group) {
      return NextResponse.json({ error: 'Group chat not found' }, { status: 404 });
    }

    // Resolve direct member IDs, exclusions, and teams
    const directIds = (group.members || []).map(m => m.toString());
    const excludedIds = (group.excludedMembers || []).map(m => m.toString());
    const teamIds = (group.teams || []).map(t => new ObjectId(t));

    const teams = await db.collection('teams').find({ _id: { $in: teamIds } }).toArray();

    const userToTeamsMap = {};
    const allUserIds = new Set(directIds);

    teams.forEach(t => {
      const members = t.members || [];
      if (t.lead) members.push(t.lead);

      members.forEach(m => {
        const mId = m.toString();
        allUserIds.add(mId);
        if (!userToTeamsMap[mId]) {
          userToTeamsMap[mId] = [];
        }
        userToTeamsMap[mId].push({ id: t._id.toString(), name: t.name });
      });
    });

    // Fetch user details for all unique users
    const userList = await db.collection('admin_users').find({
      _id: { $in: [...allUserIds].map(id => {
        try { return new ObjectId(id); } catch { return id; }
      }) }
    }).project({ username: 1, firstName: 1, lastName: 1, avatar: 1 }).toArray();

    const participants = userList.map(u => {
      const uId = u._id.toString();
      const isDirectMember = directIds.includes(uId);
      const inheritedTeams = userToTeamsMap[uId] || [];
      const isExcluded = excludedIds.includes(uId);

      return {
        id: uId,
        username: u.username,
        name: u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username,
        avatar: u.avatar || '',
        isDirectMember,
        inheritedFromTeams: inheritedTeams,
        isExcluded,
        isAdmin: isGroupAdmin(group, uId),
        isCreator: group.createdBy?.toString() === uId
      };
    });

    return NextResponse.json({
      group: {
        ...group,
        _id: group._id.toString(),
        createdBy: group.createdBy?.toString(),
        admins: (group.admins || []).map(a => a.toString())
      },
      participants,
      currentUserIsAdmin: isGroupAdmin(group, userId)
    });
  } catch (error) {
    console.error('Error fetching group info:', error);
    return NextResponse.json({ error: 'Failed to fetch group info' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const groupId = params.id;
    if (!ObjectId.isValid(groupId)) {
      return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { db } = { db: (await clientPromise).db('resources') };

    const group = await db.collection('group_chats').findOne({ _id: new ObjectId(groupId) });
    if (!group) {
      return NextResponse.json({ error: 'Group chat not found' }, { status: 404 });
    }

    // Previously unchecked — any authenticated user who knew a groupId
    // could rename/rewrite membership for any group. Only group admins
    // (or platform Admin/Console admin) may edit a group now.
    if (!canManageGroup(group, authUser)) {
      return NextResponse.json({ error: 'Forbidden: Only group admins can edit this group' }, { status: 403 });
    }

    const data = await req.json();
    // A name may be omitted (a partial edit) but never blanked.
    if (data.name !== undefined && !String(data.name).trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    // Absent means UNCHANGED. This used to read `data.members || []`, so a body
    // that simply did not mention members emptied the group — one forgetful
    // caller away from wiping a membership list with no way back.
    const toIds = (list) => list.map(id => {
      try { return new ObjectId(id); } catch { return id; }
    });
    const members = data.members !== undefined ? toIds(data.members) : (group.members || []);
    const teams = data.teams !== undefined ? toIds(data.teams) : (group.teams || []);
    const excludedMembers = data.excludedMembers !== undefined
      ? toIds(data.excludedMembers)
      : (group.excludedMembers || []);

    const updateDoc = {
      name: data.name !== undefined ? String(data.name).trim() : group.name,
      description: data.description !== undefined ? (data.description?.trim() || '') : (group.description || ''),
      members,
      teams,
      excludedMembers,
      avatar: data.avatar !== undefined ? data.avatar : (group.avatar || null),
      // Absent in the body means "leave it alone", so an older client that does
      // not know about this field cannot silently reset it to everyone.
      postingPolicy: normalizePostingPolicy(data.postingPolicy, normalizePostingPolicy(group.postingPolicy)),
      reactionVisibility: normalizeReactionVisibility(
        data.reactionVisibility,
        normalizeReactionVisibility(group.reactionVisibility),
      ),
      updatedAt: new Date()
    };

    await db.collection('group_chats').updateOne(
      { _id: new ObjectId(groupId) },
      { $set: updateDoc }
    );

    // Announce the change in the chat itself. Computed from the diff, so an
    // untouched save says nothing — a change log nobody can trust is worse
    // than none. Never blocks the response.
    for (const line of describeChanges(group, updateDoc, displayNameOf(authUser))) {
      await postSystemMessage(db, 'group', groupId, line);
    }

    return NextResponse.json({ success: true, message: 'Group updated successfully' });
  } catch (error) {
    console.error('Error updating group:', error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const groupId = params.id;
    if (!ObjectId.isValid(groupId)) {
      return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { db } = { db: (await clientPromise).db('resources') };

    const group = await db.collection('group_chats').findOne({ _id: new ObjectId(groupId) });
    if (!group) {
      return NextResponse.json({ error: 'Group chat not found' }, { status: 404 });
    }

    // Any group admin (not just the original creator) may delete the group,
    // as can a platform Admin/Console admin.
    if (!canManageGroup(group, authUser)) {
      return NextResponse.json({ error: 'Forbidden: Only group admins can delete this group' }, { status: 403 });
    }

    // Delete group document
    await db.collection('group_chats').deleteOne({ _id: new ObjectId(groupId) });

    // Delete messages
    await db.collection('group_chat_messages').deleteMany({ groupId: groupId });

    // Delete active group mutes
    await db.collection('chat_mutes').deleteMany({ chatId: groupId, chatType: 'group' });

    return NextResponse.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
