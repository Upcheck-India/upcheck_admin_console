import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

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

    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(params.id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isMember = project.members.some(m => m.user === user.username) || project.superManager === user.username;
    if (!isMember) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Support optional sprintId filtering via ?sprintId=<id>
    const { searchParams } = new URL(request.url);
    const sprintIdParam = searchParams.get('sprintId');

    let taskQuery = { projectId: new ObjectId(params.id) };
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

    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(params.id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Authorization: Only Project Managers or the Super Manager can create tasks.
    const currentUserMemberInfo = project.members.find(m => m.user === user.username);
    const isManager = currentUserMemberInfo && currentUserMemberInfo.role === 'Project Manager';
    const isSuperManager = project.superManager === user.username;

    if (!isManager && !isSuperManager) {
      return NextResponse.json({ error: 'Forbidden: Only Project Managers or the Super Manager can create tasks.' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, status, assignees, reporter, dueDate, type, sprintId } = body;

    if (!title) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const newTaskDocument = {
      projectId: new ObjectId(params.id),
      ...(sprintId && ObjectId.isValid(sprintId) ? { sprintId: new ObjectId(sprintId) } : {}),
      title,
      description: description || '',
      assignees: Array.isArray(assignees) ? assignees.map(id => new ObjectId(id)) : [],
      reporter: reporter ? new ObjectId(reporter) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: status || 'Backlog',
    type: type || 'Feature', // Add type field with default // Default status is Backlog
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
