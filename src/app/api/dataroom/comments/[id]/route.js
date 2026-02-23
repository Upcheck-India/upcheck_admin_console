import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../lib/dataroom/audit-logger';

async function getUserFromToken(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, username: 1, role: 1 } }
    );
    return user;
  } catch {
    return null;
  }
}

// GET /api/dataroom/comments/[id] - Get single comment
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid comment ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const comment = await db.collection('dataroom_comments').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    return NextResponse.json(comment);
  } catch (error) {
    console.error('GET /api/dataroom/comments/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/dataroom/comments/[id] - Edit comment
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid comment ID' }, { status: 400 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: 'Comment content cannot exceed 5000 characters' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const comment = await db.collection('dataroom_comments').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only allow editing own comments or admin override
    if (comment.createdBy.id !== user._id.toString() && user.role !== 'Admin') {
      return NextResponse.json({ error: 'You can only edit your own comments' }, { status: 403 });
    }

    // Extract mentions
    const mentionRegex = /@(\w+@?\w+\.?\w*)/g;
    const mentions = [...content.matchAll(mentionRegex)].map(m => m[1]);

    await db.collection('dataroom_comments').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          content: content.trim(),
          mentions: [...new Set(mentions)],
          isEdited: true,
          updatedAt: new Date(),
        },
      }
    );

    await logAudit({
      action: AUDIT_ACTIONS.COMMENT_EDIT,
      resourceType: 'comment',
      resourceId: id,
      roomId: comment.roomId,
      user,
      details: { documentId: comment.documentId.toString() },
      request,
    });

    const updated = await db.collection('dataroom_comments').findOne({ _id: new ObjectId(id) });
    return NextResponse.json(updated);

  } catch (error) {
    console.error('PUT /api/dataroom/comments/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/dataroom/comments/[id] - Delete comment
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid comment ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const comment = await db.collection('dataroom_comments').findOne({
      _id: new ObjectId(id),
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only allow deleting own comments or admin override
    if (comment.createdBy.id !== user._id.toString() && user.role !== 'Admin') {
      return NextResponse.json({ error: 'You can only delete your own comments' }, { status: 403 });
    }

    // Soft delete
    await db.collection('dataroom_comments').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: user._id.toString(),
        },
      }
    );

    // Also soft delete all replies
    await db.collection('dataroom_comments').updateMany(
      { parentId: new ObjectId(id) },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: user._id.toString(),
        },
      }
    );

    await logAudit({
      action: AUDIT_ACTIONS.COMMENT_DELETE,
      resourceType: 'comment',
      resourceId: id,
      roomId: comment.roomId,
      user,
      details: { documentId: comment.documentId.toString() },
      request,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/dataroom/comments/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
