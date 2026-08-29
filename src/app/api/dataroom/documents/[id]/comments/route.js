import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';
import { hasPermission } from '../../../../../../lib/dataroom/permission-checker';
import { withDataroomAuth } from '../../../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/documents/[id]/comments - List comments for document
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    // Verify document exists and user has access
    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check view permission
    const canView = await hasPermission({
      user,
      permission: 'view',
      resourceType: 'document',
      resourceId: id,
      roomId: document.roomId.toString(),
    });

    if (!canView && user.role !== 'Admin' && user.role !== 'Console admin') {
      return NextResponse.json({ error: 'You do not have permission to view this document' }, { status: 403 });
    }

    // Get comments
    const comments = await db.collection('dataroom_comments')
      .find({
        documentId: new ObjectId(id),
        isDeleted: { $ne: true },
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Build threaded structure (parent-child relationships)
    const commentMap = new Map();
    const rootComments = [];

    comments.forEach(comment => {
      comment.replies = [];
      commentMap.set(comment._id.toString(), comment);
    });

    comments.forEach(comment => {
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId.toString());
        if (parent) {
          parent.replies.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });

    return NextResponse.json({
      documentId: id,
      count: comments.length,
      rootCount: rootComments.length,
      comments: rootComments,
    });
  },
  {
    requires: 'view',
    resource: { type: 'document', param: 'id' },
  },
);

// POST /api/dataroom/documents/[id]/comments - Add comment
export const POST = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const body = await request.json();
    const {
      content,
      parentId = null,
      pageNumber = null,
      position = null,
      mentions = [],
    } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: 'Comment content cannot exceed 5000 characters' }, { status: 400 });
    }

    // Verify document exists
    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check comment permission
    const canComment = await hasPermission({
      user,
      permission: 'comment',
      resourceType: 'document',
      resourceId: id,
      roomId: document.roomId.toString(),
    });

    if (!canComment && user.role !== 'Admin' && user.role !== 'Console admin') {
      return NextResponse.json({ error: 'You do not have permission to comment on this document' }, { status: 403 });
    }

    // Verify parent comment if provided
    if (parentId) {
      if (!ObjectId.isValid(parentId)) {
        return NextResponse.json({ error: 'Invalid parentId' }, { status: 400 });
      }
      const parentComment = await db.collection('dataroom_comments').findOne({
        _id: new ObjectId(parentId),
        documentId: new ObjectId(id),
      });
      if (!parentComment) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
      }
    }

    // Extract mentions from content (@username or @email)
    const mentionRegex = /@(\w+@?\w+\.?\w*)/g;
    const extractedMentions = [...content.matchAll(mentionRegex)].map(m => m[1]);

    const newComment = {
      documentId: new ObjectId(id),
      roomId: document.roomId,
      folderId: document.folderId,
      parentId: parentId ? new ObjectId(parentId) : null,
      content: content.trim(),
      pageNumber,
      position, // { x, y } coordinates for inline annotations
      mentions: [...new Set([...mentions, ...extractedMentions])], // Unique mentions
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
      },
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('dataroom_comments').insertOne(newComment);

    await logAudit({
      action: AUDIT_ACTIONS.COMMENT_ADD,
      resourceType: 'comment',
      resourceId: result.insertedId,
      roomId: document.roomId,
      user,
      details: {
        documentId: id,
        documentName: document.name,
        isReply: !!parentId,
        mentions: newComment.mentions,
      },
      request,
    });

    return NextResponse.json({ ...newComment, _id: result.insertedId }, { status: 201 });
  },
  {
    requires: 'comment',
    resource: { type: 'document', param: 'id' },
  },
);
