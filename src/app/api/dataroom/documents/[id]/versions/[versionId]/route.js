import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { openDocumentStream } from '../../../../../../../lib/dataroom/document-storage';
import { withDataroomAuth } from '../../../../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/documents/[id]/versions/[versionId] - Get specific version
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id, versionId } = await params;

    if (!ObjectId.isValid(id) || !ObjectId.isValid(versionId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Get the document
    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get the specific version
    const version = await db.collection('dataroom_versions').findOne({
      _id: new ObjectId(versionId),
      documentId: new ObjectId(id),
    });

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // A version record carries the same storage fields as a document, so the
    // same reader finds it whichever provider it was written to.
    const stream = await openDocumentStream(db, version);

    if (!stream) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

    if (stream.nodeStream) {
      request.signal?.addEventListener('abort', () => stream.nodeStream.destroy(), { once: true });
      stream.nodeStream.on('error', (err) => console.error('Version download error:', err));
    }

    const headers = {
      'Content-Type': version.mimeType || stream.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(version.fileName || 'document')}"`,
    };
    if (stream.size != null) headers['Content-Length'] = String(stream.size);

    return new NextResponse(stream.webStream, { headers });
  },
  {
    // This endpoint returns the file as an attachment, so it is a download
    // however the URL is spelled. It required only 'view', which let anyone
    // who could read a document take away every historical version of it.
    requires: 'download',
    resource: { type: 'document', param: 'id' },
    allowExternal: true,
  },
);
