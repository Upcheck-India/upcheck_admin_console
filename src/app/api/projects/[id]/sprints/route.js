import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET  /api/projects/:id/sprints
 *      Returns list of sprints for the project (sorted by createdAt ascending)
 * POST /api/projects/:id/sprints
 *      Creates a new sprint (only Super Manager or Project Manager)
 *      Body: { name?: string, startDate?: string, endDate?: string }
 *      If name is not provided, auto-generate 'Sprint X'.
 *      After creation, all existing project tasks without a sprintId will be migrated to the first sprint created.
 */

// Helper to authenticate user via admin_token cookie and return user & db instance
async function authAndGetDb(request) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const client = await clientPromise;
  const db = client.db('resources');
  const user = await db.collection('admin_users').findOne({ sessionToken: token });
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { db, user };
}

export async function GET(request, { params }) {
  try {
    const { db, user, error } = await authAndGetDb(request);
    if (error) return error;

    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const projectId = new ObjectId(params.id);

    // Verify membership
    const project = await db.collection('projects').findOne({ _id: projectId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const isMember = project.superManager === user.username || project.members.some(m => m.user === user.username);
    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sprints = await db
      .collection('project_sprints')
      .find({ projectId })
      .sort({ createdAt: 1 })
      .toArray();

    return NextResponse.json(sprints);
  } catch (err) {
    console.error('Failed to fetch sprints:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { db, user, error } = await authAndGetDb(request);
    if (error) return error;

    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const projectId = new ObjectId(params.id);

    const project = await db.collection('projects').findOne({ _id: projectId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only Super Manager or Project Manager can create sprints
    const memberInfo = project.members.find(m => m.user === user.username);
    const isManager = memberInfo?.role === 'Project Manager';
    const isSuperManager = project.superManager === user.username;
    if (!isManager && !isSuperManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, startDate, endDate } = await request.json();

    // Determine sprint count to auto-generate name if needed
    const totalSprints = await db.collection('project_sprints').countDocuments({ projectId });
    const sprintName = (name && name.trim()) || `Sprint ${totalSprints + 1}`;

    const newSprint = {
      projectId,
      name: sprintName,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertRes = await db.collection('project_sprints').insertOne(newSprint);
    newSprint._id = insertRes.insertedId;

    // If this is the first sprint, migrate existing tasks with no sprintId to this sprint
    if (totalSprints === 0) {
      await db.collection('project_tasks').updateMany(
        { projectId, sprintId: { $exists: false } },
        { $set: { sprintId: newSprint._id, updatedAt: new Date() } }
      );
    }

    return NextResponse.json(newSprint, { status: 201 });
  } catch (err) {
    console.error('Failed to create sprint:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
