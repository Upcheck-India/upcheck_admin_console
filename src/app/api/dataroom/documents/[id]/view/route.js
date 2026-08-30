import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { GridFSBucket, ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth } from '../../../../../../lib/dataroom/withDataroomAuth';

/**
 * Parse an HTTP Range header. Only the single-range form is supported, which
 * is the only form pdf.js and every browser media element actually send.
 * Returns null for absent/unparseable, { unsatisfiable: true } for a range
 * that falls outside the file (which must be answered with 416, not 200).
 */
function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;

  const [, rawStart, rawEnd] = m;
  if (rawStart === '' && rawEnd === '') return null;

  let start;
  let end;
  if (rawStart === '') {
    // `bytes=-N` — the trailing N bytes. pdf.js uses this to read the xref
    // table at the end of the file before fetching anything else.
    const suffix = Number(rawEnd);
    if (!suffix) return { unsatisfiable: true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return { unsatisfiable: true };
  }
  return { start, end };
}

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

    const bucket = new GridFSBucket(db, { bucketName: 'dataroom_files' });

    // The authoritative size is the stored one, not the denormalised
    // document.fileSize, because a Range reply that lies about the total makes
    // the client refetch forever.
    const stored = await db
      .collection('dataroom_files.files')
      .findOne({ _id: document.fileId }, { projection: { length: 1 } });

    if (!stored) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

    const size = stored.length;
    const range = parseRange(request.headers.get('range'), size);

    if (range?.unsatisfiable) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' },
      });
    }

    // A single document view is one view, not one per range request. pdf.js
    // issues a dozen or more of these for a large file; counting them all is
    // how the view counts and the audit log became unreadable.
    if (!range) {
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

    // openDownloadStream seeks to the requested byte offset inside GridFS
    // rather than reading and discarding from the front, so a range costs the
    // range. The whole file is never held in memory — the previous
    // implementation did Buffer.concat over every chunk, which is what made
    // large documents slow to open and capable of exhausting the function.
    const nodeStream = range
      ? bucket.openDownloadStream(document.fileId, { start: range.start, end: range.end + 1 })
      : bucket.openDownloadStream(document.fileId);

    // A client that navigates away mid-stream leaves the GridFS cursor open
    // otherwise, one per abandoned view.
    request.signal?.addEventListener('abort', () => nodeStream.destroy(), { once: true });
    nodeStream.on('error', (err) => console.error('GridFS streaming error:', err));

    const headers = {
      'Content-Type': document.mimeType || 'application/octet-stream',
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

    if (range) {
      headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
      headers['Content-Length'] = String(range.end - range.start + 1);
    } else {
      headers['Content-Length'] = String(size);
    }

    return new NextResponse(Readable.toWeb(nodeStream), {
      status: range ? 206 : 200,
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
