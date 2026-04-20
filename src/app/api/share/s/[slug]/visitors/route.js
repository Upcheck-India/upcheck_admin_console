import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET /api/share/s/[slug]/visitors
 *      Get visitor information for a share link (only authorized users)
 */

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

    const { slug } = await params;

    // Find the share link
    const shareLink = await db.collection('project_share_links').findOne({ slug });

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    // Verify user has access to the project
    const project = await db.collection('projects').findOne({ _id: shareLink.projectId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isAuthorized =
      project.superManager === user.username ||
      project.members.some(m => m.user === user.username && m.role === 'Project Manager');

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all visits for this share link
    const visits = await db.collection('project_share_visits')
      .find({ shareLinkId: shareLink._id })
      .sort({ visitedAt: -1 })
      .toArray();

    return NextResponse.json(visits);
  } catch (err) {
    console.error('Failed to fetch visitors:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
