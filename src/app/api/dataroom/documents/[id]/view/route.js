import { NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth } from '../../../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/documents/[id]/view - Stream document securely for viewing
//
// Identity, the `view` grant, room expiry and the room IP whitelist are all
// enforced by the wrapper before this handler runs.
export const GET = withDataroomAuth(
  async (request, { user, db, params, room, capabilities }) => {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const chunk = searchParams.get('chunk'); // For chunk-based streaming

    // Get document
    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Track view
    await db.collection('dataroom_documents').updateOne(
      { _id: new ObjectId(id) },
      {
        $inc: { viewCount: 1 },
        $set: { lastViewedAt: new Date() }
      }
    );

    // Update analytics
    await db.collection('dataroom_analytics').updateOne(
      { documentId: new ObjectId(id), userId: user._id },
      {
        $set: {
          documentId: new ObjectId(id),
          roomId: document.roomId,
          userId: user._id,
          userEmail: user.email,
          lastViewedAt: new Date(),
        },
        $inc: { viewCount: 1 },
        $setOnInsert: {
          firstViewedAt: new Date(),
          downloadCount: 0,
          printCount: 0,
        },
      },
      { upsert: true }
    );

    // Audit log
    await logAudit({
      action: AUDIT_ACTIONS.DOCUMENT_VIEWED,
      resourceType: 'document',
      resourceId: new ObjectId(id),
      roomId: document.roomId,
      user,
      details: {
        documentName: document.name,
        fileName: document.fileName,
      },
      request,
    });

    // Stream file from GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'dataroom_files' });

    try {
      const downloadStream = bucket.openDownloadStream(document.fileId);

      // For chunk-based streaming (security feature)
      if (chunk) {
        const chunkSize = 1024 * 1024; // 1MB chunks
        const chunkNumber = parseInt(chunk);
        const skipBytes = chunkNumber * chunkSize;

        const chunks = [];
        let bytesRead = 0;
        let bytesSkipped = 0;

        for await (const data of downloadStream) {
          if (bytesSkipped < skipBytes) {
            bytesSkipped += data.length;
            continue;
          }

          chunks.push(data);
          bytesRead += data.length;

          if (bytesRead >= chunkSize) {
            break;
          }
        }

        const chunkBuffer = Buffer.concat(chunks);

        return new NextResponse(chunkBuffer, {
          headers: {
            'Content-Type': document.mimeType || 'application/octet-stream',
            'Content-Length': chunkBuffer.length.toString(),
            'X-Chunk-Number': chunk,
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        });
      }

      // Full file streaming (with caching disabled for security)
      const chunks = [];
      for await (const chunk of downloadStream) {
        chunks.push(chunk);
      }

      const fileBuffer = Buffer.concat(chunks);

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': document.mimeType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${document.fileName}"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN',
          // Effective capabilities for this viewer on this document, so the UI
          // can hide controls it must not offer. These are advisory while the
          // viewer still delegates rendering to the browser's native PDF
          // plugin, whose own Download and Print buttons ignore them — see
          // CAPABILITY_PERMISSIONS in lib/dataroom/withDataroomAuth.js.
          'X-Dataroom-Can-Download': String(!!capabilities?.canDownload),
          'X-Dataroom-Can-Print': String(!!capabilities?.canPrint),
          'X-Dataroom-Can-Comment': String(!!capabilities?.canComment),
        },
      });

    } catch (gridfsError) {
      console.error('GridFS streaming error:', gridfsError);
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }
  },
  {
    requires: 'view',
    resource: { type: 'document', param: 'id' },
    allowExternal: true,
    capabilities: true,
  },
);
