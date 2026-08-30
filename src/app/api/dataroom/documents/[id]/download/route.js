import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth } from '../../../../../../lib/dataroom/withDataroomAuth';
import { openDocumentStream } from '../../../../../../lib/dataroom/document-storage';

// GET /api/dataroom/documents/[id]/download - Download document file
//
// Identity, the `download` grant, room expiry and the room IP whitelist are all
// enforced by the wrapper before this handler runs. Only the room's own
// allowDownload setting is left here, since it is a room policy rather than a
// per-principal grant.
export const GET = withDataroomAuth(
  async (request, { user, db, params, room, isAdmin }) => {
    const { id } = params;

    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Room-wide download switch. Admins retain access so they can turn it back
    // off if it was flipped by mistake.
    if (room?.settings?.allowDownload === false && !isAdmin) {
      return NextResponse.json({ error: 'Downloads are disabled for this room' }, { status: 403 });
    }

    const stream = await openDocumentStream(db, document);

    if (!stream) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

    // Logged before the bytes are handed over, so the record exists whether or
    // not the client finishes the transfer.
    await Promise.all([
      logAudit({
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
      }),
      db.collection('dataroom_analytics').updateOne(
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
        { upsert: true },
      ),
    ]);

    // Streamed, not buffered: a download used to read the entire file into the
    // function's memory before sending the first byte.
    if (stream.nodeStream) {
      request.signal?.addEventListener('abort', () => stream.nodeStream.destroy(), { once: true });
      stream.nodeStream.on('error', (err) => console.error('Document download error:', err));
    }

    const headers = {
      'Content-Type': document.mimeType || stream.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(document.fileName || 'document')}"`,
    };
    if (stream.size != null) headers['Content-Length'] = String(stream.size);

    return new NextResponse(stream.webStream, { headers });
  },
  {
    requires: 'download',
    resource: { type: 'document', param: 'id' },
    allowExternal: true,
  },
);
