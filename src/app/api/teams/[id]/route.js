// src/app/api/teams/[id]/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAuthUser } from '../../../../lib/auth';

// GET - Get single team details
export async function GET(req, { params }) {
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

    // Permission check - Members/Interns can only see teams they belong to
    if (userRole !== 'Admin' && userRole !== 'Console admin') {
      const isMember = team.members?.some(m => m.toString() === userId);
      const isLead = team.lead?.toString() === userId;

      if (!isMember && !isLead) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Populate lead and members info
    const lead = team.lead ? await db.collection('admin_users')
      .findOne({ _id: team.lead }, { projection: { password: 0 } }) : null;

    const members = team.members && team.members.length > 0
      ? await db.collection('admin_users')
        .find({ _id: { $in: team.members } })
        .project({ password: 0 })
        .toArray()
      : [];

    const createdBy = team.createdBy ? await db.collection('admin_users')
      .findOne({ _id: team.createdBy }, { projection: { password: 0 } }) : null;

    return NextResponse.json({
      ...team,
      lead,
      members,
      createdBy,
      memberCount: members.length
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team: ' + error.message },
      { status: 500 }
    );
  }
}

// PUT - Update team (Admin/Console admin or Team lead only)
export async function PUT(req, { params }) {
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

    // Permission check - Admin/Console admin or Team lead can update
    const isAdmin = userRole === 'Admin' || userRole === 'Console admin';
    const isLead = team.lead?.toString() === userId;

    if (!isAdmin && !isLead) {
      return NextResponse.json(
        { error: 'Unauthorized to update this team' },
        { status: 403 }
      );
    }

    const data = await req.json();
    const updateData = {
      updatedAt: new Date()
    };

    // Update allowed fields
    if (data.name) {
      // Check if new name already exists (excluding current team)
      const existingTeam = await db.collection('teams').findOne({
        name: data.name.trim(),
        _id: { $ne: new ObjectId(teamId) }
      });

      if (existingTeam) {
        return NextResponse.json(
          { error: 'Team name already exists' },
          { status: 400 }
        );
      }
      updateData.name = data.name.trim();
    }

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || '';
    }

    // Allow changing team lead (Admin/Console admin or current lead)
    if (data.lead) {
      if (!ObjectId.isValid(data.lead)) {
        return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
      }

      // Verify new lead is a team member
      const newLeadId = new ObjectId(data.lead);
      const isNewLeadMember = team.members?.some(m => m.equals(newLeadId));

      if (!isNewLeadMember) {
        return NextResponse.json(
          { error: 'New lead must be a team member first' },
          { status: 400 }
        );
      }

      updateData.lead = newLeadId;
    }

    const result = await db.collection('teams').updateOne(
      { _id: new ObjectId(teamId) },
      { $set: updateData }
    );

    return NextResponse.json({ message: 'Team updated successfully' });
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json(
      { error: 'Failed to update team: ' + error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete team (Admin/Console admin or Team lead only)
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

    // Permission check - Admin/Console admin or Team lead can delete
    const isAdmin = userRole === 'Admin' || userRole === 'Console admin';
    const isLead = team.lead?.toString() === userId;

    if (!isAdmin && !isLead) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this team' },
        { status: 403 }
      );
    }

    const result = await db.collection('teams').deleteOne({
      _id: new ObjectId(teamId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to delete team' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json(
      { error: 'Failed to delete team: ' + error.message },
      { status: 500 }
    );
  }
}