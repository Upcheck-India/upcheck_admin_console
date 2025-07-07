import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper to verify auth and permissions
async function getAuthorizedUserProjectSprint(req, params) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const client = await clientPromise;
  const db = client.db('resources');
  const user = await db.collection('admin_users').findOne({ sessionToken: token });
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { id: projectId, sprintId } = params;
  if (!ObjectId.isValid(projectId) || !ObjectId.isValid(sprintId)) {
    return { error: NextResponse.json({ error: 'Invalid ID' }, { status: 400 }) };
  }

  const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };

  const sprint = await db.collection('project_sprints').findOne({ _id: new ObjectId(sprintId), projectId: project._id });
  if (!sprint) return { error: NextResponse.json({ error: 'Sprint not found' }, { status: 404 }) };

  const isSuperManager = project.superManager === user.username;
  const isProjectManager = project.members?.some(m => m.user === user.username && m.role === 'Project Manager');
  const canEdit = isSuperManager || isProjectManager;
  const isMember = project.members?.some(m => m.user === user.username);

  return { client, db, user, project, sprint, canEdit, isMember };
}

export async function GET(req, { params }) {
  try {
    const auth = await getAuthorizedUserProjectSprint(req, params);
    if (auth.error) return auth.error;
    const { db, project, sprint, isMember } = auth;
    if (!isMember) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const canvas = await db.collection('project_canvases').findOne({ projectId: project._id, sprintId: sprint._id });
    return NextResponse.json({ content: canvas?.content || '' });
  } catch (err) {
    console.error('Error fetching sprint canvas', err);
    return NextResponse.json({ error: 'Failed to fetch canvas' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const auth = await getAuthorizedUserProjectSprint(req, params);
    if (auth.error) return auth.error;
    const { db, project, sprint, canEdit } = auth;
    if (!canEdit) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { content } = await req.json();
    if (typeof content !== 'string') return NextResponse.json({ error: 'Invalid content' }, { status: 400 });

    await db.collection('project_canvases').updateOne(
      { projectId: project._id, sprintId: sprint._id },
      {
        $set: { content, updatedAt: new Date() },
        $setOnInsert: { projectId: project._id, sprintId: sprint._id, createdAt: new Date() },
      },
      { upsert: true }
    );
    return NextResponse.json({ message: 'Canvas saved' });
  } catch (err) {
    console.error('Error saving sprint canvas', err);
    return NextResponse.json({ error: 'Failed to save canvas' }, { status: 500 });
  }
}
