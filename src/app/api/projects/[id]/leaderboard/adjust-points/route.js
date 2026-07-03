import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

function isProjectManager(user, project) {
  if (user.role === 'Super Manager') return true;
  if (project.superManager === user.username) return true;
  return project.members?.some(m => m.user === user.username && m.role === 'Project Manager') || false;
}

function isConsoleAdmin(user) {
  return user.role === 'Console admin' || user.role === 'Admin';
}

// Console admins/admins can always adjust points, and can also revoke that
// ability from project managers via the points-permission endpoint below.
function canAdjustPoints(user, project) {
  if (isConsoleAdmin(user)) return true;
  if (!isProjectManager(user, project)) return false;
  return project.leaderboardSettings?.allowManagerPointsAdjustment !== false;
}

async function getAuthedUser(req, db) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token) return null;
  return db.collection('admin_users').findOne({ sessionToken: token });
}

// GET - adjustment history for a project (optionally filtered by username)
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

    if (!isConsoleAdmin(user) && !isProjectManager(user, project)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    const query = { projectId: new ObjectId(id) };
    if (username) query.username = username;

    const history = await db.collection('project_points_adjustments')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      history: history.map(h => ({
        ...h,
        _id: h._id.toString(),
        projectId: h.projectId.toString(),
      })),
      canAdjust: canAdjustPoints(user, project),
    });
  } catch (error) {
    console.error('Failed to fetch points adjustment history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST - record a manual point adjustment for a member
export async function POST(req, { params }) {
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

    if (!canAdjustPoints(user, project)) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to adjust leaderboard points for this project' }, { status: 403 });
    }

    const { username, delta, reason } = await req.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }
    const numericDelta = Number(delta);
    if (!Number.isFinite(numericDelta) || numericDelta === 0) {
      return NextResponse.json({ error: 'delta must be a non-zero number' }, { status: 400 });
    }
    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'A reason is required for point adjustments' }, { status: 400 });
    }

    const adjustment = {
      projectId: new ObjectId(id),
      username,
      delta: numericDelta,
      reason: reason.trim(),
      adjustedBy: user.username,
      adjustedByName: user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username,
      createdAt: new Date(),
    };

    const result = await db.collection('project_points_adjustments').insertOne(adjustment);

    return NextResponse.json({
      success: true,
      adjustment: { ...adjustment, _id: result.insertedId.toString(), projectId: id },
    });
  } catch (error) {
    console.error('Failed to record points adjustment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
