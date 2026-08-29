import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth } from '../../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/documents/[id] - Get single document
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Enforce permissions for view access
    const { hasPermission } = await import('../../../../../lib/dataroom/permission-checker');
    const canView = await hasPermission({
      user,
      resourceType: 'document',
      resourceId: id,
      permission: 'view',
      roomId: document.roomId
    });

    if (!canView) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Log document view
    await logAudit({
      action: AUDIT_ACTIONS.DOCUMENT_VIEW,
      resourceType: 'document',
      resourceId: id,
      roomId: document.roomId,
      user,
      details: { name: document.name, method: 'api_get' },
      request,
    });

    // Track analytics
    await db.collection('dataroom_analytics').updateOne(
      { documentId: new ObjectId(id), date: new Date().toISOString().split('T')[0] },
      {
        $inc: { viewCount: 1 },
        $push: {
          views: {
            userId: user._id.toString(),
            userEmail: user.email,
            timestamp: new Date(),
          },
        },
      },
      { upsert: true }
    );

    return NextResponse.json(document);
  },
  {
    requires: 'view',
    resource: { type: 'document', param: 'id' },
  },
);

// PUT /api/dataroom/documents/[id] - Update document
export const PUT = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, documentType, metadata, state, folderId } = body;

    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if document is locked by another user
    if (document.isLocked && document.lockedBy !== user._id.toString()) {
      return NextResponse.json({ error: 'Document is locked by another user' }, { status: 423 });
    }

    const updates = { updatedAt: new Date() };

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (documentType !== undefined) updates.documentType = documentType;
    if (metadata !== undefined) updates.metadata = { ...document.metadata, ...metadata };
    if (state !== undefined && ['draft', 'published', 'archived'].includes(state)) {
      updates.state = state;
    }

    // Handle folder move
    if (folderId !== undefined) {
      if (folderId === null) {
        updates.folderId = null;
      } else if (ObjectId.isValid(folderId)) {
        const folder = await db.collection('dataroom_folders').findOne({
          _id: new ObjectId(folderId),
          roomId: document.roomId,
          isDeleted: { $ne: true },
        });
        if (!folder) {
          return NextResponse.json({ error: 'Target folder not found' }, { status: 404 });
        }
        updates.folderId = new ObjectId(folderId);
      }
    }

    await db.collection('dataroom_documents').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    await logAudit({
      action: AUDIT_ACTIONS.DOCUMENT_EDIT,
      resourceType: 'document',
      resourceId: id,
      roomId: document.roomId,
      user,
      details: { updates: Object.keys(updates) },
      request,
    });

    const updatedDocument = await db.collection('dataroom_documents').findOne({ _id: new ObjectId(id) });
    return NextResponse.json(updatedDocument);
  },
  {
    requires: 'edit',
    resource: { type: 'document', param: 'id' },
  },
);

// DELETE /api/dataroom/documents/[id] - Delete document
export const DELETE = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (permanent) {
      // Delete versions
      await db.collection('dataroom_versions').deleteMany({ documentId: new ObjectId(id) });
      // Delete comments
      await db.collection('dataroom_comments').deleteMany({ documentId: new ObjectId(id) });
      // Delete document
      await db.collection('dataroom_documents').deleteOne({ _id: new ObjectId(id) });
    } else {
      // Soft delete
      await db.collection('dataroom_documents').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: user._id.toString(),
          },
        }
      );
    }

    await logAudit({
      action: AUDIT_ACTIONS.DOCUMENT_DELETE,
      resourceType: 'document',
      resourceId: id,
      roomId: document.roomId,
      user,
      details: { permanent, name: document.name },
      request,
    });

    return NextResponse.json({ success: true, permanent });
  },
  {
    requires: 'edit',
    resource: { type: 'document', param: 'id' },
  },
);
