import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

function isProjectManager(user, project) {
  if (user.role === 'Super Manager') return true;
  if (project.superManager === user.username) return true;
  return project.members?.some(m => m.user === user.username && m.role === 'Project Manager') || false;
}

// POST - Grant a custom badge to a member
export async function POST(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
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

    // Check manager permissions
    if (!isProjectManager(user, project)) {
      return NextResponse.json({ error: 'Forbidden: Only managers can grant custom badges' }, { status: 403 });
    }

    const body = await req.json();
    const { username, badgeId } = body;

    if (!username || !badgeId) {
      return NextResponse.json({ error: 'Username and badgeId are required' }, { status: 400 });
    }

    // Verify badge exists
    const badge = await db.collection('project_custom_badges').findOne({ 
      _id: new ObjectId(badgeId),
      projectId: new ObjectId(id)
    });

    if (!badge) {
      return NextResponse.json({ error: 'Custom badge not found' }, { status: 404 });
    }

    // Check if already granted
    const existingGrant = await db.collection('project_member_badges').findOne({
      projectId: new ObjectId(id),
      username,
      badgeId: new ObjectId(badgeId)
    });

    if (existingGrant) {
      return NextResponse.json({ error: 'Badge already granted to this user' }, { status: 400 });
    }

    // Insert grant
    const grant = {
      projectId: new ObjectId(id),
      username,
      badgeId: new ObjectId(badgeId),
      grantedAt: new Date(),
      grantedBy: user.username
    };

    await db.collection('project_member_badges').insertOne(grant);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to grant custom badge:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE - Revoke a custom badge from a member
export async function DELETE(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
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

    // Check manager permissions
    if (!isProjectManager(user, project)) {
      return NextResponse.json({ error: 'Forbidden: Only managers can revoke custom badges' }, { status: 403 });
    }

    const body = await req.json();
    const { username, badgeId } = body;

    if (!username || !badgeId) {
      return NextResponse.json({ error: 'Username and badgeId are required' }, { status: 400 });
    }

    // Delete grant
    const result = await db.collection('project_member_badges').deleteOne({
      projectId: new ObjectId(id),
      username,
      badgeId: new ObjectId(badgeId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Badge grant not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to revoke custom badge:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
