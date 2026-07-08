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

// POST — the calling user leaves the group. Mirrors the "a group must always
// have at least one admin" safety check already enforced on demote
// ([id]/admins/route.js): if the leaver is the sole admin, they must promote
// someone else first rather than leaving the group admin-less.
export async function POST(req, { params }) {
  try {
    const groupId = params.id;
    if (!ObjectId.isValid(groupId)) {
      return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const group = await db.collection('group_chats').findOne({ _id: new ObjectId(groupId) });
    if (!group) {
      return NextResponse.json({ error: 'Group chat not found' }, { status: 404 });
    }

    const userId = authUser._id.toString();
    const directMemberIds = (group.members || []).map((m) => m.toString());
    if (!directMemberIds.includes(userId)) {
      return NextResponse.json({ error: 'You are not a member of this group' }, { status: 400 });
    }

    const currentAdmins = (group.admins || []).map((a) => a.toString());
    const isAdmin = currentAdmins.includes(userId);
    if (isAdmin && currentAdmins.length === 1) {
      return NextResponse.json(
        { error: 'You are the only admin. Promote another member to admin before leaving the group.' },
        { status: 400 }
      );
    }

    await db.collection('group_chats').updateOne(
      { _id: new ObjectId(groupId) },
      {
        $pull: { members: new ObjectId(userId), admins: new ObjectId(userId) },
        $set: { updatedAt: new Date() },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error leaving group:', error);
    return NextResponse.json({ error: 'Failed to leave group' }, { status: 500 });
  }
}
