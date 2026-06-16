import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { canAccessProject, canCreateInProject } from '../../../../../lib/projectPermissions';

// GET all tasks for a project
export async function GET(request, { params }) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify membership / access using the permission system
    const userIdStr = user._id?.toString();
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
          { lead: userIdStr },
        ],
      })
      .toArray();

    if (!canAccessProject(user, project, userTeams)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Support optional sprintId filtering via ?sprintId=<id>
    const { searchParams } = new URL(request.url);
    const sprintIdParam = searchParams.get('sprintId');

    let taskQuery = { projectId: new ObjectId(id) };
    if (sprintIdParam) {
      if (ObjectId.isValid(sprintIdParam)) {
        taskQuery.sprintId = new ObjectId(sprintIdParam);
      } else if (sprintIdParam === 'null' || sprintIdParam === 'none') {
        taskQuery.sprintId = { $exists: false };
      }
    }

    const tasks = await db.collection('project_tasks').find(taskQuery).toArray();

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST a new task to a project
export async function POST(request, { params }) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify write permissions using the permission system
    const userIdStr = user._id?.toString();
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
          { lead: userIdStr },
        ],
      })
      .toArray();

    if (!canCreateInProject(user, project, userTeams)) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to create tasks in this project.' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, status, assignees, reporter, dueDate, type, sprintId } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const newTaskDocument = {
      projectId: new ObjectId(id),
      ...(sprintId && ObjectId.isValid(sprintId) ? { sprintId: new ObjectId(sprintId) } : {}),
      title,
      description: description || '',
      assignees: Array.isArray(assignees) ? assignees.map(tId => new ObjectId(tId)) : [],
      reporter: reporter ? new ObjectId(reporter) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: status || 'Backlog',
      type: type || 'Feature',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('project_tasks').insertOne(newTaskDocument);

    return NextResponse.json({ ...newTaskDocument, _id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
