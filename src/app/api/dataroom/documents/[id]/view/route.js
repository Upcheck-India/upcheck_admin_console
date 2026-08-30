import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth } from '../../../../../../lib/dataroom/withDataroomAuth';
import { openDocumentStream, parseRange } from '../../../../../../lib/dataroom/document-storage';

// GET /api/dataroom/documents/[id]/view - Stream document securely for viewing
//
// Identity, the `view` grant, room expiry and the room IP whitelist are all
// enforced by the wrapper before this handler runs.
export const GET = withDataroomAuth(
  async (request, { user, db, params, capabilities }) => {
    const { id } = params;

    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const requested = parseRange(request.headers.get('range'), document.fileSize);

    if (requested?.unsatisfiable) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${document.fileSize}`,
          'Accept-Ranges': 'bytes',
        },
      });
    }

    // A single document view is one view, not one per range request. pdf.js
    // issues a dozen or more of these for a large file; counting them all is
    // how the view counts and the audit log became unreadable.
    if (!requested) {
      await Promise.all([
        db.collection('dataroom_documents').updateOne(
          { _id: new ObjectId(id) },
          { $inc: { viewCount: 1 }, $set: { lastViewedAt: new Date() } },
        ),
        db.collection('dataroom_analytics').updateOne(
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
            $setOnInsert: { firstViewedAt: new Date(), downloadCount: 0, printCount: 0 },
          },
          { upsert: true },
        ),
        logAudit({
          action: AUDIT_ACTIONS.DOCUMENT_VIEWED,
          resourceType: 'document',
          resourceId: new ObjectId(id),
          roomId: document.roomId,
          user,
          details: { documentName: document.name, fileName: document.fileName },
          request,
        }),
      ]);
    }

    // Whichever provider actually holds this document's bytes. Nothing is
    // buffered: the previous implementation did Buffer.concat over every chunk
    // before sending a byte, which put each document's full size against the
    // function's memory limit and delayed the response until the last chunk
    // arrived from storage.
    const stream = await openDocumentStream(db, document, requested || undefined);

    if (!stream) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

    // A client that navigates away mid-stream leaves the storage cursor open
    // otherwise, one per abandoned view.
    if (stream.nodeStream) {
      request.signal?.addEventListener('abort', () => stream.nodeStream.destroy(), { once: true });
      stream.nodeStream.on('error', (err) => console.error('Document stream error:', err));
    }

    const headers = {
      'Content-Type': document.mimeType || stream.contentType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(document.fileName || 'document')}"`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      // Effective capabilities for this viewer on this document, so the UI can
      // hide controls it must not offer.
      'X-Dataroom-Can-Download': String(!!capabilities?.canDownload),
      'X-Dataroom-Can-Print': String(!!capabilities?.canPrint),
      'X-Dataroom-Can-Comment': String(!!capabilities?.canComment),
    };

    if (stream.size != null) headers['Content-Length'] = String(stream.size);

    // `stream.range` is what the provider actually delivered, not what was
    // asked for. Vercel Blob may ignore a Range and return the whole object;
    // answering 206 in that case would make the client wait forever for bytes
    // that already arrived under a different offset.
    if (stream.range) {
      headers['Content-Range'] =
        `bytes ${stream.range.start}-${stream.range.end}/${stream.range.total ?? document.fileSize}`;
    }

    return new NextResponse(stream.webStream, {
      status: stream.range ? 206 : 200,
      headers,
    });
  },
  {
    requires: 'view',
    resource: { type: 'document', param: 'id' },
    allowExternal: true,
    capabilities: true,
  },
);
