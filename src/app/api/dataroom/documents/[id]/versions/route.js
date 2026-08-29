import { NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth } from '../../../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/documents/[id]/versions - List all versions
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

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
  },
  {
    requires: 'view',
    resource: { type: 'document', param: 'id' },
  },
);

// POST /api/dataroom/documents/[id]/versions - Upload new version
export const POST = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

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
  },
  {
    requires: 'edit',
    resource: { type: 'document', param: 'id' },
  },
);
