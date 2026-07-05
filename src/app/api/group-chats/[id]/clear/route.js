import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
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

// POST /api/group-chats/[id]/clear — Clear group chat messages for current user
export async function POST(req, { params }) {
  try {
    const { id: groupId } = await params;

    if (!groupId || !ObjectId.isValid(groupId)) {
      return NextResponse.json({ error: 'Invalid Group ID' }, { status: 400 });
    }

    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify user is a member of the group
    const group = await db.collection('group_chats').findOne({
      _id: new ObjectId(groupId),
      'members.userId': user._id.toString()
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found or not a member' }, { status: 404 });
    }

    const userId = user._id.toString();
    const { forEveryone } = await req.json().catch(() => ({ forEveryone: false }));

    // Only admin-level or group creator can clear for everyone
    const isGroupAdmin = group.createdBy === userId ||
      (group.admins || []).includes(userId);
    const isOrgAdmin = ['admin', 'console admin', 'console_admin'].includes((user.role || '').toLowerCase());

    if (forEveryone && !isGroupAdmin && !isOrgAdmin) {
      return NextResponse.json({ error: 'Only group admins can clear chat for everyone' }, { status: 403 });
    }

    if (forEveryone) {
      // Mark all messages as deleted for everyone
      await db.collection('group_chat_messages').updateMany(
        { groupId },
        { $set: { deletedForEveryone: true } }
      );
    } else {
      // Soft-delete for this user only
      await db.collection('group_chat_messages').updateMany(
        { groupId },
        { $addToSet: { deletedFor: userId } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Group clear chat error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

