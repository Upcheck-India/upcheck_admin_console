import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
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

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');

    let userRole = req.headers.get('x-user-role');
    let userId = req.headers.get('x-user-id');

    if (!userRole || !userId) {
      const authUser = await getAuthUser(req);
      if (authUser) {
        userRole = authUser.role;
        userId = authUser._id.toString();
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get teams the user is in
    const userTeams = await db.collection('teams').find({
      $or: [
        { members: userId },
        { lead: userId },
        { members: new ObjectId(userId) },
        { lead: new ObjectId(userId) }
      ]
    }).toArray();
    
    const teamIds = userTeams.map(t => t._id);
    const teamIdsStr = teamIds.map(id => id.toString());

    // Find group chats
    const groupQuery = {
      $and: [
        {
          $or: [
            { members: new ObjectId(userId) },
            { members: userId },
            { teams: { $in: teamIds } },
            { teams: { $in: teamIdsStr } }
          ]
        },
        { excludedMembers: { $ne: new ObjectId(userId) } },
        { excludedMembers: { $ne: userId } }
      ]
    };

    const groupChats = await db.collection('group_chats')
      .find(groupQuery)
      .sort({ updatedAt: -1 })
      .toArray();

    // Get unread counts for these groups
    let unreadMap = {};
    const groupIds = groupChats.map(g => g._id.toString());
    
    const unreadCounts = await db.collection('group_chat_messages')
      .aggregate([
        {
          $match: {
            groupId: { $in: groupIds },
            senderId: { $ne: userId },
            'readBy.userId': { $ne: userId }
          }
        },
        {
          $group: {
            _id: '$groupId',
            count: { $sum: 1 }
          }
        }
      ])
      .toArray();

    unreadMap = unreadCounts.reduce((acc, u) => {
      acc[u._id] = { count: u.count };
      return acc;
    }, {});

    // Fetch active mutes for groups
    const mutes = await db.collection('chat_mutes').find({
      userId: userId,
      chatType: 'group'
    }).toArray();

    const muteMap = mutes.reduce((acc, m) => {
      const isMuted = m.isForever || (m.mutedUntil && new Date(m.mutedUntil) > new Date());
      if (isMuted) {
        acc[m.chatId] = m;
      }
      return acc;
    }, {});

    const populatedGroups = groupChats.map(group => {
      const muteInfo = muteMap[group._id.toString()];
      return {
        ...group,
        unreadCount: unreadMap[group._id.toString()]?.count || 0,
        memberCount: (group.members?.length || 0) + (group.teams?.length || 0), // rough count
        isMuted: !!muteInfo,
        mutedUntil: muteInfo?.mutedUntil || null
      };
    });

    return NextResponse.json({
      groupChats: populatedGroups
    });
  } catch (error) {
    console.error('Error fetching group chats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group chats: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');

    let userRole = req.headers.get('x-user-role');
    let userId = req.headers.get('x-user-id');

    if (!userRole || !userId) {
      const authUser = await getAuthUser(req);
      if (authUser) {
        userRole = authUser.role;
        userId = authUser._id.toString();
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();

    if (!data.name || !data.name.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    const members = (data.members || []).map(id => {
      try { return new ObjectId(id); } catch { return id; }
    });
    // Ensure creator is in members
    const creatorObjId = new ObjectId(userId);
    if (!members.some(m => m.toString() === userId)) {
      members.push(creatorObjId);
    }

    const teams = (data.teams || []).map(id => {
      try { return new ObjectId(id); } catch { return id; }
    });

    const newGroup = {
      name: data.name.trim(),
      description: data.description?.trim() || '',
      members,
      teams,
      createdBy: creatorObjId,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessagePreview: 'Group created'
    };

    const result = await db.collection('group_chats').insertOne(newGroup);

    return NextResponse.json({
      message: 'Group chat created successfully',
      groupId: result.insertedId
    });
  } catch (error) {
    console.error('Error creating group chat:', error);
    return NextResponse.json(
      { error: 'Failed to create group chat: ' + error.message },
      { status: 500 }
    );
  }
}
