import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserPermissionLevel } from '../../../../../../../lib/projectPermissions';

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

    const { id, taskId } = await params;

    if (!ObjectId.isValid(id) || !ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permissions
    const userIdStr = user._id?.toString();
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
          { lead: userIdStr },
          { members: user._id },
          { lead: user._id },
        ],
      })
      .toArray();

    const perms = getUserPermissionLevel(user, project, userTeams);

    // Comments are often open to anyone with read access.
    const canComment = perms && ['full', 'write', 'read'].includes(perms.level);

    if (!canComment) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to comment on tasks.' }, { status: 403 });
    }

    const body = await request.json();
    const { text, mentions } = body;

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }

    const newComment = {
      _id: new ObjectId(),
      text: text.trim(),
      mentions: mentions || [], // Array of user IDs
      authorId: user._id,
      authorName: user.username || user.name || 'Unknown',
      createdAt: new Date(),
    };

    const result = await db.collection('project_tasks').updateOne(
      { _id: new ObjectId(taskId) },
      { 
        $push: { comments: newComment },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Comment added', comment: newComment });
  } catch (error) {
    console.error('Failed to add comment:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error.message 
    }, { status: 500 });
  }
}
