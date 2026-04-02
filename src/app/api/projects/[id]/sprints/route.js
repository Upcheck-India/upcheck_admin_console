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
 * PUT  /api/projects/:id/sprints
 *      Updates a sprint (only Super Manager or Project Manager)
 *      Body: { sprintId: string, name?: string, startDate?: string, endDate?: string }
 * DELETE /api/projects/:id/sprints
 *      Deletes a sprint (only Super Manager or Project Manager)
 *      Body: { sprintId: string }
 *      Tasks in the sprint will be moved to backlog (sprintId set to null)
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

// Helper to check if user is manager of the project
function isProjectManager(user, project) {
  return project.superManager === user.username ||
         project.members.some(m => m.user === user.username && m.role === 'Project Manager');
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

export async function PUT(request, { params }) {
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

    // Only Super Manager or Project Manager can update sprints
    if (!isProjectManager(user, project)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { sprintId, name, startDate, endDate } = await request.json();

    if (!sprintId || !ObjectId.isValid(sprintId)) {
      return NextResponse.json({ error: 'Invalid sprint ID' }, { status: 400 });
    }

    const sprint = await db.collection('project_sprints').findOne({ _id: new ObjectId(sprintId), projectId });
    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    updateData.updatedAt = new Date();

    await db.collection('project_sprints').updateOne(
      { _id: new ObjectId(sprintId), projectId },
      { $set: updateData }
    );

    const updatedSprint = await db.collection('project_sprints').findOne({ _id: new ObjectId(sprintId), projectId });
    return NextResponse.json(updatedSprint);
  } catch (err) {
    console.error('Failed to update sprint:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
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

    // Only Super Manager or Project Manager can delete sprints
    if (!isProjectManager(user, project)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { sprintId } = await request.json();

    if (!sprintId || !ObjectId.isValid(sprintId)) {
      return NextResponse.json({ error: 'Invalid sprint ID' }, { status: 400 });
    }

    const sprint = await db.collection('project_sprints').findOne({ _id: new ObjectId(sprintId), projectId });
    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    // Delete the sprint
    await db.collection('project_sprints').deleteOne({ _id: new ObjectId(sprintId), projectId });

    // Move all tasks in this sprint to backlog (set sprintId to null)
    await db.collection('project_tasks').updateMany(
      { projectId, sprintId: new ObjectId(sprintId) },
      { $set: { sprintId: null, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true, message: 'Sprint deleted successfully' });
  } catch (err) {
    console.error('Failed to delete sprint:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
