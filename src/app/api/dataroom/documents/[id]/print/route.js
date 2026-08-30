import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth } from '../../../../../../lib/dataroom/withDataroomAuth';

// POST /api/dataroom/documents/[id]/print - Record a print
//
// No bytes are served here. The viewer prints the page canvases it has already
// rendered, so printing needs no second copy of the file — it needs the `print`
// grant checked server-side and the act recorded, which is what this does.
// A client that skipped this call would still be printing pixels it was
// allowed to see; the real enforcement is that the viewer never hands the
// original file to the browser's PDF plugin in the first place.
export const POST = withDataroomAuth(
  async (request, { user, db, params }) => {
    const { id } = params;

    const document = await db.collection('dataroom_documents').findOne(
      { _id: new ObjectId(id), isDeleted: { $ne: true } },
      { projection: { name: 1, fileName: 1, roomId: 1 } },
    );

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const { pages = null } = await request.json().catch(() => ({}));

    await Promise.all([
      db.collection('dataroom_analytics').updateOne(
        { documentId: new ObjectId(id), userId: user._id },
        {
          $inc: { printCount: 1 },
          $set: { lastPrintedAt: new Date() },
          $setOnInsert: {
            documentId: new ObjectId(id),
            roomId: document.roomId,
            userId: user._id,
            userEmail: user.email,
            viewCount: 0,
            downloadCount: 0,
          },
        },
        { upsert: true },
      ),
      logAudit({
        action: AUDIT_ACTIONS.DOCUMENT_PRINT,
        resourceType: 'document',
        resourceId: new ObjectId(id),
        roomId: document.roomId,
        user,
        details: { documentName: document.name, fileName: document.fileName, pages },
        request,
      }),
    ]);

    return NextResponse.json({ success: true });
  },
  {
    requires: 'print',
    resource: { type: 'document', param: 'id' },
    allowExternal: true,
    allowShare: true,
  },
);
