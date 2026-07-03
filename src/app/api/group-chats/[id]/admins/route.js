import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { canManageGroup } from '../../../../../lib/groupPermissions';

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

// Resolves whether `targetId` is currently a participant of the group
// (direct member, or inherited via one of the group's teams, and not
// excluded) — mirrors the participant-resolution logic in [id]/route.js GET.
async function isGroupParticipant(db, group, targetId) {
  const directIds = (group.members || []).map(m => m.toString());
  const excludedIds = (group.excludedMembers || []).map(m => m.toString());
  if (excludedIds.includes(targetId)) return false;
  if (directIds.includes(targetId)) return true;

  const teamIds = (group.teams || []).map(t => new ObjectId(t));
  if (teamIds.length === 0) return false;
  const teams = await db.collection('teams').find({ _id: { $in: teamIds } }).toArray();
  return teams.some(t => {
    const members = (t.members || []).map(m => m.toString());
    if (t.lead) members.push(t.lead.toString());
    return members.includes(targetId);
  });
}

// POST { userId, action: 'promote' | 'demote' } — only existing group admins
// (or a platform Admin/Console admin) can promote/demote.
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

    if (!canManageGroup(group, authUser)) {
      return NextResponse.json({ error: 'Forbidden: Only group admins can manage admins' }, { status: 403 });
    }

    const { userId: targetId, action } = await req.json();
    if (!targetId || !['promote', 'demote'].includes(action)) {
      return NextResponse.json({ error: 'userId and a valid action (promote|demote) are required' }, { status: 400 });
    }

    if (!(await isGroupParticipant(db, group, targetId))) {
      return NextResponse.json({ error: 'That user is not a member of this group' }, { status: 400 });
    }

    const currentAdmins = (group.admins || []).map(a => a.toString());

    if (action === 'promote') {
      if (currentAdmins.includes(targetId)) {
        return NextResponse.json({ success: true, admins: currentAdmins });
      }
      await db.collection('group_chats').updateOne(
        { _id: new ObjectId(groupId) },
        { $addToSet: { admins: new ObjectId(targetId) }, $set: { updatedAt: new Date() } }
      );
      return NextResponse.json({ success: true, admins: [...currentAdmins, targetId] });
    }

    // Demote — never allow the admins list to become empty, and the
    // original creator can only be demoted by another admin (not by
    // themselves), mirroring the "lead must assign a new lead" safety
    // check used for teams.
    if (targetId === group.createdBy?.toString() && authUser._id.toString() === targetId) {
      return NextResponse.json({ error: 'The group creator cannot demote themselves' }, { status: 400 });
    }
    const remainingAdmins = currentAdmins.filter(a => a !== targetId);
    if (remainingAdmins.length === 0) {
      return NextResponse.json({ error: 'A group must always have at least one admin' }, { status: 400 });
    }

    await db.collection('group_chats').updateOne(
      { _id: new ObjectId(groupId) },
      { $pull: { admins: new ObjectId(targetId) }, $set: { updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true, admins: remainingAdmins });
  } catch (error) {
    console.error('Error managing group admins:', error);
    return NextResponse.json({ error: 'Failed to update group admins' }, { status: 500 });
  }
}
