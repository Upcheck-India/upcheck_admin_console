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

function isAdminLike(user) {
  return user && (user.role === 'Admin' || user.role === 'Console admin');
}

// GET /api/dataroom/documents/[id] - Get single document
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Log document view
    await logAudit({
      action: AUDIT_ACTIONS.DOCUMENT_VIEW,
      resourceType: 'document',
      resourceId: id,
      roomId: document.roomId,
      user,
      details: { name: document.name },
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
  } catch (error) {
    console.error('GET /api/dataroom/documents/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/dataroom/documents/[id] - Update document
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, documentType, metadata, state, folderId } = body;

    const client = await clientPromise;
    const db = client.db('resources');

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

  } catch (error) {
    console.error('PUT /api/dataroom/documents/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/dataroom/documents/[id] - Delete document
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    const client = await clientPromise;
    const db = client.db('resources');

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

  } catch (error) {
    console.error('DELETE /api/dataroom/documents/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
