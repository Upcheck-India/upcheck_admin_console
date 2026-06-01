// src/app/api/teams/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// GET - List teams (filtered by user role and membership) with pagination
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

    // Get query parameters for pagination
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

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
          { members: userId },
          { lead: userId },
          { members: new ObjectId(userId) },
          { lead: new ObjectId(userId) }
        ]
      };
    }

    // Get total count for pagination
    const totalCount = await db.collection('teams').countDocuments(query);

    // Fetch teams with pagination
    const teams = await db.collection('teams')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Collect all unique lead and member IDs
    const allUserIds = new Set();
    teams.forEach(team => {
      if (team.lead) allUserIds.add(team.lead.toString());
      if (team.members) {
        team.members.forEach(m => {
          if (m) allUserIds.add(m.toString());
        });
      }
    });

    // Single query to fetch all users (fixes N+1)
    const userIdArray = Array.from(allUserIds).map(id => {
      try {
        return new ObjectId(id);
      } catch {
        return id;
      }
    });

    const allUsers = await db.collection('admin_users')
      .find({ _id: { $in: userIdArray } })
      .project({ password: 0, username: 1, email: 1, role: 1, firstName: 1, lastName: 1, department: 1, jobTitle: 1 })
      .toArray();

    // Create a lookup map
    const userLookup = new Map();
    allUsers.forEach(user => {
      userLookup.set(user._id.toString(), user);
    });

    // Populate lead and member info using lookup
    const populatedTeams = teams.map(team => {
      const lead = team.lead ? userLookup.get(team.lead.toString()) : null;
      const members = (team.members || [])
        .map(mId => userLookup.get(mId?.toString() || mId))
        .filter(Boolean);

      return {
        ...team,
        lead,
        members,
        memberCount: members.length
      };
    });

    return NextResponse.json({
      teams: populatedTeams,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + limit < totalCount
      }
    });
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