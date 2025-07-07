import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper to verify auth and permissions
async function getAuthorizedUserAndProject(req, params) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const client = await clientPromise;
  const db = client.db('resources');
  const user = await db.collection('admin_users').findOne({ sessionToken: token });
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { id } = params;
  if (!ObjectId.isValid(id)) return { error: NextResponse.json({ error: 'Invalid project ID' }, { status: 400 }) };

  const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };

  const isSuperManager = project.superManager === user.username;
  const isProjectManager = project.members?.some(m => m.user === user.username && m.role === 'Project Manager');
  const canEdit = isSuperManager || isProjectManager;
  const isMember = project.members?.some(m => m.user === user.username);

  return { client, db, user, project, canEdit, isMember };
}

// GET super canvas for project (no sprintId)
export async function GET(req, { params }) {
  try {
    const auth = await getAuthorizedUserAndProject(req, params);
    if (auth.error) return auth.error;

    const { db, project, isMember, canEdit } = auth;
    if (!isMember && !canEdit) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const canvas = await db.collection('project_canvases').findOne({ projectId: project._id, sprintId: null });
    return NextResponse.json({ content: canvas?.content || '' });
  } catch (err) {
    console.error('Error fetching canvas', err);
    return NextResponse.json({ error: 'Failed to fetch canvas' }, { status: 500 });
  }
}

// PUT to create/update super canvas
export async function PUT(req, { params }) {
  try {
    const auth = await getAuthorizedUserAndProject(req, params);
    if (auth.error) return auth.error;
    const { db, project, canEdit } = auth;
    if (!canEdit) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { content } = await req.json();
    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    }

    await db.collection('project_canvases').updateOne(
      { projectId: project._id, sprintId: null },
      {
        $set: {
          content,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          projectId: project._id,
          sprintId: null,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ message: 'Canvas saved' });
  } catch (err) {
    console.error('Error saving canvas', err);
    return NextResponse.json({ error: 'Failed to save canvas' }, { status: 500 });
  }
}
