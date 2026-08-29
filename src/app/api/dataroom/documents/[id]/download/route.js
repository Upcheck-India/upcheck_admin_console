import { NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth } from '../../../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/documents/[id]/download - Download document file
//
// Identity, the `download` grant, room expiry and the room IP whitelist are all
// enforced by the wrapper before this handler runs. Only the room's own
// allowDownload setting is left here, since it is a room policy rather than a
// per-principal grant.
export const GET = withDataroomAuth(
  async (request, { user, db, params, room, isAdmin }) => {
    const { id } = params;

    // Get document metadata
    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!document.fileId) {
      return NextResponse.json({ error: 'No file associated with this document' }, { status: 404 });
    }

    // Room-wide download switch. Admins retain access so they can turn it back
    // off if it was flipped by mistake.
    if (room?.settings?.allowDownload === false && !isAdmin) {
      return NextResponse.json({ error: 'Downloads are disabled for this room' }, { status: 403 });
    }

    // Get file from GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'dataroom_files' });

    // Find the file
    const files = await bucket.find({ _id: document.fileId }).toArray();
    if (files.length === 0) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

    const file = files[0];

    // Create download stream
    const downloadStream = bucket.openDownloadStream(document.fileId);

    // Collect chunks
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Log download
    await logAudit({
      action: AUDIT_ACTIONS.DOCUMENT_DOWNLOAD,
      resourceType: 'document',
      resourceId: id,
      roomId: document.roomId,
      user,
      details: {
        name: document.name,
        fileName: document.fileName,
        fileSize: document.fileSize,
      },
      request,
    });

    // Update analytics
    await db.collection('dataroom_analytics').updateOne(
      { documentId: new ObjectId(id), date: new Date().toISOString().split('T')[0] },
      {
        $inc: { downloadCount: 1 },
        $push: {
          downloads: {
            userId: user._id.toString(),
            userEmail: user.email,
            timestamp: new Date(),
          },
        },
      },
      { upsert: true }
    );

    // Return file
    const headers = new Headers();
    headers.set('Content-Type', file.contentType || document.mimeType || 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(document.fileName || file.filename)}"`);
    headers.set('Content-Length', buffer.length.toString());

    return new NextResponse(buffer, { headers });
  },
  {
    requires: 'download',
    resource: { type: 'document', param: 'id' },
    allowExternal: true,
  },
);
