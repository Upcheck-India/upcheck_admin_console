import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

function isConsoleAdmin(user) {
  return user.role === 'Console admin' || user.role === 'Admin';
}

async function getAuthedUser(req, db) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token) return null;
  return db.collection('admin_users').findOne({ sessionToken: token });
}

// GET - current "can project managers adjust points" flag for a project
export async function GET(req, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await getAuthedUser(req, db);
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

    return NextResponse.json({
      allowManagerPointsAdjustment: project.leaderboardSettings?.allowManagerPointsAdjustment !== false,
    });
  } catch (error) {
    console.error('Failed to fetch points permission:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT - Console admin/Admin only: toggle whether Project Managers retain
// the ability to adjust leaderboard points for this project.
export async function PUT(req, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await getAuthedUser(req, db);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isConsoleAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden: Only Console admins/Admins can change this setting' }, { status: 403 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const { allowManagerPointsAdjustment } = await req.json();
    if (typeof allowManagerPointsAdjustment !== 'boolean') {
      return NextResponse.json({ error: 'allowManagerPointsAdjustment must be a boolean' }, { status: 400 });
    }

    const result = await db.collection('projects').updateOne(
      { _id: new ObjectId(id) },
      { $set: { 'leaderboardSettings.allowManagerPointsAdjustment': allowManagerPointsAdjustment } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, allowManagerPointsAdjustment });
  } catch (error) {
    console.error('Failed to update points permission:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
