import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

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
        isExcluded
      };
    });

    return NextResponse.json({
      group: {
        ...group,
        _id: group._id.toString(),
        createdBy: group.createdBy?.toString()
      },
      participants
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

    const data = await req.json();
    if (!data.name || !data.name.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    const members = (data.members || []).map(id => {
      try { return new ObjectId(id); } catch { return id; }
    });
    const teams = (data.teams || []).map(id => {
      try { return new ObjectId(id); } catch { return id; }
    });
    const excludedMembers = (data.excludedMembers || []).map(id => {
      try { return new ObjectId(id); } catch { return id; }
    });

    const updateDoc = {
      name: data.name.trim(),
      description: data.description?.trim() || '',
      members,
      teams,
      excludedMembers,
      updatedAt: new Date()
    };

    await db.collection('group_chats').updateOne(
      { _id: new ObjectId(groupId) },
      { $set: updateDoc }
    );

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

    // Verify creator or admin permissions
    const isCreator = group.createdBy?.toString() === authUser._id.toString();
    const isAdmin = authUser.role === 'Admin' || authUser.role === 'Console admin';

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Only group creator or Admin can delete group' }, { status: 403 });
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
