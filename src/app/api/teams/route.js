// src/app/api/teams/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// GET - List teams (filtered by user role and membership)
export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');

    // Get user info from headers
    const userRole = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');

    if (!userRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build query based on role
    let query = {};

    // Admins and Console admins can see all teams
    if (userRole !== 'Admin' && userRole !== 'Console admin') {
      // Members/Interns can only see teams they belong to
      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 401 });
      }
      query = {
        $or: [
          { members: new ObjectId(userId) },
          { lead: new ObjectId(userId) }
        ]
      };
    }

    const teams = await db.collection('teams')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Populate lead and member info for each team
    const populatedTeams = await Promise.all(teams.map(async (team) => {
      // Get lead info
      const lead = team.lead ? await db.collection('admin_users')
        .findOne({ _id: team.lead }, { projection: { password: 0 } }) : null;

      // Get members info
      const members = team.members && team.members.length > 0
        ? await db.collection('admin_users')
          .find({ _id: { $in: team.members } })
          .project({ password: 0 })
          .toArray()
        : [];

      return {
        ...team,
        lead,
        members,
        memberCount: members.length
      };
    }));

    return NextResponse.json(populatedTeams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams: ' + error.message },
      { status: 500 }
    );
  }
}

// POST - Create new team (Admin/Console admin only)
export async function POST(req) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');

    const userRole = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');

    // Permission check - only Admin and Console admin can create teams
    if (userRole !== 'Admin' && userRole !== 'Console admin') {
      return NextResponse.json(
        { error: 'Unauthorized to create teams' },
        { status: 403 }
      );
    }

    const data = await req.json();

    // Validate required fields
    if (!data.name || !data.name.trim()) {
      return NextResponse.json(
        { error: 'Team name is required' },
        { status: 400 }
      );
    }

    // Check if team name already exists
    const existingTeam = await db.collection('teams').findOne({
      name: data.name.trim()
    });

    if (existingTeam) {
      return NextResponse.json(
        { error: 'Team name already exists' },
        { status: 400 }
      );
    }

    // Create team with creator as lead by default
    const newTeam = {
      name: data.name.trim(),
      description: data.description?.trim() || '',
      lead: new ObjectId(userId), // Creator becomes lead by default
      members: data.members
        ? data.members.map(id => new ObjectId(id))
        : [new ObjectId(userId)], // Creator is also a member
      createdBy: new ObjectId(userId),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('teams').insertOne(newTeam);

    return NextResponse.json({
      message: 'Team created successfully',
      teamId: result.insertedId
    });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json(
      { error: 'Failed to create team: ' + error.message },
      { status: 500 }
    );
  }
}