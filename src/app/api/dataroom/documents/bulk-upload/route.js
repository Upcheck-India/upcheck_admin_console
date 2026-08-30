import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../lib/dataroom/audit-logger';
import { scanFile } from '../../../../../lib/dataroom/virus-scanner';
import { storeDocumentFile } from '../../../../../lib/dataroom/document-storage';
import { withDataroomAuth } from '../../../../../lib/dataroom/withDataroomAuth';

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'application/zip',
  'application/x-rar-compressed',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// POST /api/dataroom/documents/bulk-upload - Bulk upload multiple documents
export const POST = withDataroomAuth(
  async (request, { user, db, params }) => {

    const formData = await request.formData();
    const files = formData.getAll('files');
    const roomId = formData.get('roomId');
    const folderId = formData.get('folderId');
    const documentType = formData.get('documentType') || 'general';

    // Validation
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 files allowed per bulk upload' }, { status: 400 });
    }

    if (!roomId || !ObjectId.isValid(roomId)) {
      return NextResponse.json({ error: 'Valid roomId required' }, { status: 400 });
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
    let folder = null;
    if (folderId && folderId !== 'null' && folderId !== 'root') {
      if (!ObjectId.isValid(folderId)) {
        return NextResponse.json({ error: 'Invalid folderId' }, { status: 400 });
      }
      folder = await db.collection('dataroom_folders').findOne({
        _id: new ObjectId(folderId),
        roomId: new ObjectId(roomId),
        isDeleted: { $ne: true },
      });
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
    }

    const results = {
      total: files.length,
      successful: [],
      failed: [],
    };

    // Process each file
    for (const file of files) {
      try {
        // Validate file
        if (file.size > MAX_FILE_SIZE) {
          results.failed.push({
            fileName: file.name,
            error: `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
          });
          continue;
        }

        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
          results.failed.push({
            fileName: file.name,
            error: 'File type not allowed',
          });
          continue;
        }

        // Virus scan
        const scanResult = await scanFile(file, file.name);

        if (!scanResult.safe) {
          results.failed.push({
            fileName: file.name,
            error: 'File blocked by security scan',
            threats: scanResult.threatLabels || [],
          });

          await logAudit({
            action: AUDIT_ACTIONS.DOCUMENT_UPLOAD_BLOCKED,
            resourceType: 'document',
            roomId: new ObjectId(roomId),
            user,
            details: {
              fileName: file.name,
              fileSize: file.size,
              threats: scanResult.threats,
              viruses: scanResult.viruses,
            },
            request,
          });
          continue;
        }

        // Streamed into the active provider. Bulk upload used to hold each
        // file in memory as a Buffer; fifty of those at 100MB each is not a
        // budget any function has.
        const storage = await storeDocumentFile(db, file, {
          roomId: new ObjectId(roomId),
          user,
        });

        // Create document record
        const newDocument = {
          name: file.name.replace(/\.[^/.]+$/, ''),
          fileName: file.name,
          ...storage,
          fileSize: file.size,
          mimeType: file.type,
          roomId: new ObjectId(roomId),
          folderId: folder ? new ObjectId(folderId) : null,
          folderPath: folder ? folder.path : '/',
          documentType,
          indexNumber: null,
          version: 1,
          state: 'published',
          stateHistory: [{ state: 'published', changedAt: new Date(), changedBy: user.email }],
          metadata: {},
          tags: [],
          viewCount: 0,
          downloadCount: 0,
          printCount: 0,
          isLocked: false,
          isDeleted: false,
          // The scanner hashes the bytes as it reads them; there is no local
          // copy to hash here any more, and re-reading the file to compute one
          // would undo the point of streaming it.
          fileHash: scanResult.fileHash || null,
          createdAt: new Date(),
          createdBy: {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
          },
          updatedAt: new Date(),
        };

        const result = await db.collection('dataroom_documents').insertOne(newDocument);

        // Create version record
        await db.collection('dataroom_versions').insertOne({
          documentId: result.insertedId,
          versionNumber: 1,
          ...storage,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          createdAt: new Date(),
          createdBy: newDocument.createdBy,
          changeNote: 'Bulk upload',
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

        results.successful.push({
          fileName: file.name,
          documentId: result.insertedId,
          scanned: !scanResult.scanSkipped,
        });

      } catch (fileError) {
        console.error(`Error uploading ${file.name}:`, fileError);
        results.failed.push({
          fileName: file.name,
          error: fileError.message || 'Upload failed',
        });
      }
    }

    // Audit log for bulk upload
    await logAudit({
      action: AUDIT_ACTIONS.DOCUMENT_BULK_UPLOAD,
      resourceType: 'document',
      roomId: new ObjectId(roomId),
      user,
      details: {
        totalFiles: results.total,
        successful: results.successful.length,
        failed: results.failed.length,
        folderId: folderId || 'root',
      },
      request,
    });

    return NextResponse.json({
      message: `Bulk upload completed: ${results.successful.length} succeeded, ${results.failed.length} failed`,
      results,
    }, { status: 201 });
  },
  {
    selfScoped: true,
  },
);
