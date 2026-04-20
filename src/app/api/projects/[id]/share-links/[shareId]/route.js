import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * DELETE /api/projects/:id/share-links/:shareId
 *      Deletes/revokes a share link (only Super Manager or Project Manager)
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

function isProjectManager(user, project) {
  return project.superManager === user.username ||
         project.members.some(m => m.user === user.username && m.role === 'Project Manager');
}

export async function DELETE(request, { params }) {
  try {
    const { db, user, error } = await authAndGetDb(request);
    if (error) return error;

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const projectId = new ObjectId(id);
    const project = await db.collection('projects').findOne({ _id: projectId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only Super Manager or Project Manager can delete share links
    if (!isProjectManager(user, project)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { shareId } = await params;
    if (!ObjectId.isValid(shareId)) {
      return NextResponse.json({ error: 'Invalid share link ID' }, { status: 400 });
    }

    const result = await db.collection('project_share_links')
      .deleteOne({ _id: new ObjectId(shareId), projectId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Share link revoked successfully' });
  } catch (err) {
    console.error('Failed to delete share link:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
