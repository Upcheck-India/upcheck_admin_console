import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../lib/dataroom/audit-logger';

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

function isAdminLike(user) {
  return user && (user.role === 'Admin' || user.role === 'Console admin');
}

// GET /api/dataroom/documents - List documents
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const folderId = searchParams.get('folderId');
    const search = searchParams.get('search');
    const docType = searchParams.get('type');
    const limit = Math.min(Number.parseInt(searchParams.get('limit') || '50', 10), 200);
    const skip = Number.parseInt(searchParams.get('skip') || '0', 10);

    const client = await clientPromise;
    const db = client.db('resources');

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

    const [documents, total] = await Promise.all([
      db.collection('dataroom_documents')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('dataroom_documents').countDocuments(filter),
    ]);

    return NextResponse.json({
      count: documents.length,
      total,
      skip,
      limit,
      items: documents,
    });
  } catch (error) {
    console.error('GET /api/dataroom/documents error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/dataroom/documents - Create document metadata (file upload handled separately)
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

    const client = await clientPromise;
    const db = client.db('resources');

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
      state: 'draft',
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

  } catch (error) {
    console.error('POST /api/dataroom/documents error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
