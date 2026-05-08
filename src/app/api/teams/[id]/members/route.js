// src/app/api/teams/[id]/members/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// POST - Add member to team
export async function POST(req, { params }) {
  try {
    const { id: teamId } = await params;
    const client = await clientPromise;
    const db = client.db('resources');

    const userRole = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');

    if (!ObjectId.isValid(teamId)) {
      return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 });
    }

    const team = await db.collection('teams').findOne({
      _id: new ObjectId(teamId)
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Permission check - Admin/Console admin or Team lead can add members
    const isAdmin = userRole === 'Admin' || userRole === 'Console admin';
    const isLead = team.lead?.toString() === userId;

    if (!isAdmin && !isLead) {
      return NextResponse.json(
        { error: 'Unauthorized to add members to this team' },
        { status: 403 }
      );
    }

    const data = await req.json();

    if (!data.userId || !ObjectId.isValid(data.userId)) {
      return NextResponse.json({ error: 'Valid user ID is required' }, { status: 400 });
    }

    const newMemberId = new ObjectId(data.userId);

    // Verify user exists
    const user = await db.collection('admin_users').findOne({
      _id: newMemberId
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is already a member
    const isAlreadyMember = team.members?.some(m => m.equals(newMemberId));

    if (isAlreadyMember) {
      return NextResponse.json(
        { error: 'User is already a team member' },
        { status: 400 }
      );
    }

    // Add member to team
    const result = await db.collection('teams').updateOne(
      { _id: new ObjectId(teamId) },
      {
        $push: { members: newMemberId },
        $set: { updatedAt: new Date() }
      }
    );

    return NextResponse.json({
      message: 'Member added successfully',
      user: { _id: user._id, username: user.username, role: user.role }
    });
  } catch (error) {
    console.error('Error adding member:', error);
    return NextResponse.json(
      { error: 'Failed to add member: ' + error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove member from team
export async function DELETE(req, { params }) {
  try {
    const { id: teamId } = await params;
    const client = await clientPromise;
    const db = client.db('resources');

    const userRole = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');

    if (!ObjectId.isValid(teamId)) {
      return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 });
    }

    const team = await db.collection('teams').findOne({
      _id: new ObjectId(teamId)
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Permission check - Admin/Console admin or Team lead can remove members
    const isAdmin = userRole === 'Admin' || userRole === 'Console admin';
    const isLead = team.lead?.toString() === userId;

    // Also allow members to remove themselves (leave team)
    const isSelfRemoval = req.headers.get('x-remove-self') === 'true';

    if (!isAdmin && !isLead && !isSelfRemoval) {
      return NextResponse.json(
        { error: 'Unauthorized to remove members from this team' },
        { status: 403 }
      );
    }

    // Get member ID from query params
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('userId');

    if (!memberId || !ObjectId.isValid(memberId)) {
      return NextResponse.json({ error: 'Valid user ID is required' }, { status: 400 });
    }

    const memberObjectId = new ObjectId(memberId);

    // Check if user is a member
    const isMember = team.members?.some(m => m.equals(memberObjectId));

    if (!isMember) {
      return NextResponse.json(
        { error: 'User is not a team member' },
        { status: 400 }
      );
    }

    // Check if removing the team lead
    if (team.lead?.equals(memberObjectId)) {
      // Team lead cannot leave unless they assign a new lead first
      if (memberId === userId && !isAdmin) {
        return NextResponse.json(
          { error: 'Team lead must assign a new lead before leaving' },
          { status: 400 }
        );
      }

      // Admin can remove lead, but need to assign new lead
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Cannot remove team lead. Assign a new lead first.' },
          { status: 400 }
        );
      }
    }

    // Remove member from team
    const result = await db.collection('teams').updateOne(
      { _id: new ObjectId(teamId) },
      {
        $pull: { members: memberObjectId },
        $set: { updatedAt: new Date() }
      }
    );

    // If lead was removed and admin is doing it, set new lead if provided
    if (team.lead?.equals(memberObjectId) && isAdmin) {
      const newLeadId = searchParams.get('newLeadId');
      if (newLeadId && ObjectId.isValid(newLeadId)) {
        await db.collection('teams').updateOne(
          { _id: new ObjectId(teamId) },
          { $set: { lead: new ObjectId(newLeadId) } }
        );
      } else {
        // Remove lead reference if no new lead assigned
        await db.collection('teams').updateOne(
          { _id: new ObjectId(teamId) },
          { $unset: { lead: 1 } }
        );
      }
    }

    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to remove member: ' + error.message },
      { status: 500 }
    );
  }
}