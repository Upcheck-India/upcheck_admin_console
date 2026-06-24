// src/app/api/teams/[id]/members/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { sendTemplatedEmail, EMAIL_TYPES } from '../../../../../lib/emailService.js';
import { getAuthUser } from '../../../../../lib/auth';

// POST - Add member to team
export async function POST(req, { params }) {
  try {
    const authData = await getAuthUser(req);
    if (!authData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = authData.user;
    const userRole = currentUser.role;
    const userId = currentUser._id.toString();

    const { id: teamId } = await params;
    const db = authData.db;

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

    // Send email notification to the added member
    try {
      // Get the person who added them
      const adder = await db.collection('admin_users').findOne(
        { _id: userId ? new ObjectId(userId) : null },
        { projection: { username: 1, firstName: 1, lastName: 1 } }
      );

      const addedBy = adder?.firstName || adder?.lastName ? `${adder.firstName} ${adder.lastName}`.trim() : adder?.username || 'an administrator';

      if (user?.email) {
        await sendTemplatedEmail(EMAIL_TYPES.TEAM_MEMBER_ADDED, {
          teamName: team.name,
          memberName: user.firstName || user.lastName ? `${user.firstName} ${user.lastName}`.trim() : user.username,
          addedBy: addedBy,
          role: user.role
        }, {
          to: user.email
        });
        console.log(`Team member added notification sent to ${user.email}`);
      }
    } catch (emailError) {
      console.error('Failed to send team member added email:', emailError.message);
      // Don't fail the operation if email fails
    }

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
    const authData = await getAuthUser(req);
    if (!authData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = authData.user;
    const userRole = currentUser.role;
    const userId = currentUser._id.toString();

    const { id: teamId } = await params;
    const db = authData.db;

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