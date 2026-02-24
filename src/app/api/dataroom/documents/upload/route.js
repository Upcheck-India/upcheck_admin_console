import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { GridFSBucket, ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../lib/dataroom/audit-logger';
import { scanFile } from '../../../../../lib/dataroom/virus-scanner';

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

// Allowed file types
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// POST /api/dataroom/documents/upload - Upload file to GridFS and create document
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get('file');
    const roomId = formData.get('roomId');
    const folderId = formData.get('folderId');
    const name = formData.get('name');
    const description = formData.get('description') || '';
    const documentType = formData.get('documentType') || 'document';
    const tagsRaw = formData.get('tags');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!roomId || !ObjectId.isValid(roomId)) {
      return NextResponse.json({ error: 'Valid roomId is required' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    // SECURITY: Virus scan before upload
    const scanResult = await scanFile(file, file.name);

    if (!scanResult.safe) {
      await logAudit({
        action: 'VIRUS_SCAN_BLOCKED',
        resourceType: 'document',
        resourceId: null,
        roomId: new ObjectId(roomId),
        user,
        details: {
          fileName: file.name,
          fileSize: file.size,
          threats: scanResult.threats,
          threatLabels: scanResult.threatLabels,
          viruses: scanResult.viruses,
        },
        request,
      });

      return NextResponse.json({
        error: 'File blocked by security scan',
        threats: scanResult.threatLabels,
        viruses: scanResult.viruses,
      }, { status: 403 });
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
    if (folderId && folderId !== 'null') {
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

    // Upload file to GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'dataroom_files' });
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadStream = bucket.openUploadStream(file.name, {
      contentType: file.type,
      metadata: {
        roomId: new ObjectId(roomId),
        uploadedBy: user._id.toString(),
        uploadedByEmail: user.email,
        originalName: file.name,
      },
    });

    await new Promise((resolve, reject) => {
      uploadStream.write(buffer);
      uploadStream.end();
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
    });

    const fileId = uploadStream.id;

    // Generate document index number
    const lastDoc = await db.collection('dataroom_documents')
      .find({ roomId: new ObjectId(roomId) })
      .sort({ indexNumber: -1 })
      .limit(1)
      .toArray();

    const indexNumber = (lastDoc[0]?.indexNumber || 0) + 1;

    // Parse tags
    let tags = [];
    if (tagsRaw) {
      try {
        tags = JSON.parse(tagsRaw);
      } catch {
        tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
      }
    }

    // Create document record
    const newDocument = {
      roomId: new ObjectId(roomId),
      folderId: targetFolderId,
      name: (name || file.name).trim(),
      description: description.trim(),
      documentType,
      indexNumber,
      fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      metadata: { tags },
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
      fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      createdAt: new Date(),
      createdBy: newDocument.createdBy,
      changeNote: 'Initial upload',
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
        fileName: file.name,
        fileSize: file.size,
        documentType,
        indexNumber,
        virusScanResult: scanResult.scanSkipped ? 'skipped' : 'clean',
        fileHash: scanResult.fileHash,
      },
      request,
    });

    return NextResponse.json({
      ...newDocument,
      _id: result.insertedId,
      security: {
        scanned: !scanResult.scanSkipped,
        scanSkippedReason: scanResult.scanSkipped ? scanResult.reason : null,
        provider: scanResult.securityProvider || 'Cloudmersive',
        providerUrl: scanResult.securityProviderUrl || 'https://cloudmersive.com',
        fileHash: scanResult.fileHash,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/dataroom/documents/upload error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
