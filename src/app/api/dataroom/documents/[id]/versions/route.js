import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { GridFSBucket, ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';

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

// GET /api/dataroom/documents/[id]/versions - List all versions
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

    // Verify document exists
    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get all versions
    const versions = await db.collection('dataroom_versions')
      .find({ documentId: new ObjectId(id) })
      .sort({ versionNumber: -1 })
      .toArray();

    return NextResponse.json({
      documentId: id,
      currentVersion: document.currentVersion,
      count: versions.length,
      versions,
    });
  } catch (error) {
    console.error('GET /api/dataroom/documents/[id]/versions error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/dataroom/documents/[id]/versions - Upload new version
export async function POST(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify document exists
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

    const formData = await request.formData();
    const file = formData.get('file');
    const changeNote = formData.get('changeNote') || '';
    const isMajor = formData.get('isMajor') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Upload file to GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'dataroom_files' });
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadStream = bucket.openUploadStream(file.name, {
      contentType: file.type,
      metadata: {
        roomId: document.roomId,
        documentId: new ObjectId(id),
        uploadedBy: user._id.toString(),
        uploadedByEmail: user.email,
        originalName: file.name,
        isVersion: true,
      },
    });

    await new Promise((resolve, reject) => {
      uploadStream.write(buffer);
      uploadStream.end();
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
    });

    const fileId = uploadStream.id;

    // Calculate new version number
    const currentVersion = document.currentVersion || 1;
    const newVersion = isMajor 
      ? Math.floor(currentVersion) + 1 
      : currentVersion + 0.1;

    // Create version record
    const versionRecord = {
      documentId: new ObjectId(id),
      versionNumber: newVersion,
      fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      changeNote: changeNote.trim(),
      createdAt: new Date(),
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
    };

    await db.collection('dataroom_versions').insertOne(versionRecord);

    // Update document with new version
    await db.collection('dataroom_documents').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          currentVersion: newVersion,
          fileId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          updatedAt: new Date(),
        },
      }
    );

    await logAudit({
      action: AUDIT_ACTIONS.VERSION_CREATE,
      resourceType: 'document',
      resourceId: id,
      roomId: document.roomId,
      user,
      details: {
        versionNumber: newVersion,
        fileName: file.name,
        changeNote: changeNote.trim(),
        isMajor,
      },
      request,
    });

    return NextResponse.json(versionRecord, { status: 201 });

  } catch (error) {
    console.error('POST /api/dataroom/documents/[id]/versions error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
