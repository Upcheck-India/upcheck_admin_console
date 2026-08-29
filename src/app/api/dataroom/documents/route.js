import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../lib/dataroom/audit-logger';
import { getAccessibleDocumentsFilter } from '../../../../lib/dataroom/permission-checker';
import { withDataroomAuth } from '../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/documents - List documents
//
// selfScoped: this endpoint filters its own results through
// getAccessibleDocumentsFilter rather than checking a single resource, so the
// wrapper's per-resource gate does not apply. The scoping lives in the query
// below and must stay there.
export const GET = withDataroomAuth(
  async (request, { user, db }) => {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const folderId = searchParams.get('folderId');
    const search = searchParams.get('search');
    const docType = searchParams.get('type');
    const limit = Math.min(Number.parseInt(searchParams.get('limit') || '50', 10), 200);
    const skip = Number.parseInt(searchParams.get('skip') || '0', 10);

    const filter = { isDeleted: { $ne: true } };

    if (roomId) {
      if (!ObjectId.isValid(roomId)) {
        return NextResponse.json({ error: 'Invalid roomId' }, { status: 400 });
      }
      filter.roomId = new ObjectId(roomId);
    }

    if (folderId && folderId !== 'null') {
      if (!ObjectId.isValid(folderId)) {
        return NextResponse.json({ error: 'Invalid folderId' }, { status: 400 });
      }
      filter.folderId = new ObjectId(folderId);
    } else if (roomId && (folderId === 'null' || folderId === null)) {
      // If roomId is provided and folderId is explicitly 'null' or actual null, only return documents in the root of the room
      filter.folderId = null;
    }

    if (search) {
      // SECURITY: Sanitize search to prevent ReDoS
      const sanitizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').substring(0, 100);
      filter.$or = [
        { name: { $regex: sanitizedSearch, $options: 'i' } },
        { 'metadata.tags': { $regex: sanitizedSearch, $options: 'i' } },
      ];
    }

    if (docType) {
      filter.documentType = docType;
    }

    // ACCESS CONTROL. Without this the endpoint returned every document in
    // every room to any authenticated account — and with no `roomId`, the
    // entire corpus. The filter mirrors hasPermission's additive grant
    // semantics (room OR folder OR document grant, or authorship); it is null
    // only for Admin / Console admin, who may see everything.
    //
    // Combined under $and so it can never be clobbered by the caller-supplied
    // `search` clause, which also uses $or.
    const accessFilter = await getAccessibleDocumentsFilter(user);
    const scopedFilter = accessFilter
      ? { $and: [filter, accessFilter] }
      : filter;

    const [documents, total] = await Promise.all([
      db.collection('dataroom_documents')
        .find(scopedFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('dataroom_documents').countDocuments(scopedFilter),
    ]);

    return NextResponse.json({
      count: documents.length,
      total,
      skip,
      limit,
      items: documents,
    });
  },
  { selfScoped: true, allowExternal: true },
);

// POST /api/dataroom/documents - Create document metadata (file upload handled separately)
//
// Requires the `edit` grant on the destination room. This replaces a blanket
// admin-only check: a room manager who is not a platform admin can now add
// documents to rooms they administer, and access is decided by a recorded
// grant rather than by role alone.
export const POST = withDataroomAuth(
  async (request, { user, db }) => {
    const body = await request.json();
    const {
      roomId,
      folderId,
      name,
      description = '',
      documentType = 'document',
      fileId = null,
      fileName = null,
      fileSize = 0,
      mimeType = 'application/octet-stream',
      metadata = {},
      tags = [],
    } = body;

    if (!roomId || !ObjectId.isValid(roomId)) {
      return NextResponse.json({ error: 'Valid roomId is required' }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Document name is required' }, { status: 400 });
    }

    // Verify room exists
    const room = await db.collection('dataroom_rooms').findOne({
      _id: new ObjectId(roomId),
      isDeleted: { $ne: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Verify folder if provided
    let targetFolderId = null;
    if (folderId) {
      if (!ObjectId.isValid(folderId)) {
        return NextResponse.json({ error: 'Invalid folderId' }, { status: 400 });
      }
      const folder = await db.collection('dataroom_folders').findOne({
        _id: new ObjectId(folderId),
        roomId: new ObjectId(roomId),
        isDeleted: { $ne: true },
      });
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
      targetFolderId = new ObjectId(folderId);
    }

    // Generate document index number
    const lastDoc = await db.collection('dataroom_documents')
      .find({ roomId: new ObjectId(roomId) })
      .sort({ indexNumber: -1 })
      .limit(1)
      .toArray();

    const indexNumber = (lastDoc[0]?.indexNumber || 0) + 1;

    const newDocument = {
      roomId: new ObjectId(roomId),
      folderId: targetFolderId,
      name: name.trim(),
      description: description.trim(),
      documentType,
      indexNumber,
      fileId: fileId ? new ObjectId(fileId) : null,
      fileName,
      fileSize,
      mimeType,
      metadata: {
        ...metadata,
        tags: Array.isArray(tags) ? tags : [],
      },
      currentVersion: 1,
      state: 'published',
      isLocked: false,
      lockedBy: null,
      lockedAt: null,
      isDeleted: false,
      createdAt: new Date(),
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
      updatedAt: new Date(),
    };

    const result = await db.collection('dataroom_documents').insertOne(newDocument);

    // Create initial version record
    await db.collection('dataroom_versions').insertOne({
      documentId: result.insertedId,
      versionNumber: 1,
      fileId: newDocument.fileId,
      fileName: newDocument.fileName,
      fileSize: newDocument.fileSize,
      mimeType: newDocument.mimeType,
      createdAt: new Date(),
      createdBy: newDocument.createdBy,
      changeNote: 'Initial version',
    });

    // Auto-grant the creator 'admin' access to the document
    await db.collection('dataroom_permissions').insertOne({
      resourceType: 'document',
      resourceId: result.insertedId.toString(),
      roomId: roomId.toString(),
      userId: user._id.toString(),
      userEmail: user.email,
      groupId: null,
      permissions: ['admin'],
      expiresAt: null,
      grantedBy: {
        id: user._id.toString(),
        email: user.email,
      },
      grantedAt: new Date(),
      updatedAt: new Date(),
    });

    await logAudit({
      action: AUDIT_ACTIONS.DOCUMENT_UPLOAD,
      resourceType: 'document',
      resourceId: result.insertedId,
      roomId: new ObjectId(roomId),
      user,
      details: {
        name: newDocument.name,
        documentType,
        indexNumber,
        folderId: targetFolderId?.toString(),
      },
      request,
    });

    return NextResponse.json({ ...newDocument, _id: result.insertedId }, { status: 201 });
  },
  {
    requires: 'edit',
    // roomId arrives in the JSON body. The wrapper must not consume the request
    // stream the handler still needs, so read a clone.
    resolve: async (request) => {
      const body = await request.clone().json().catch(() => ({}));
      return body?.roomId ? { type: 'room', id: String(body.roomId) } : null;
    },
  },
);
