import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { withDataroomAuth } from '../../../../../../lib/dataroom/withDataroomAuth';
import { getPageInfo, MAX_RENDERABLE_BYTES } from '../../../../../../lib/dataroom/page-render';

// GET /api/dataroom/documents/[id]/pages - Page count and page dimensions
//
// What the viewer needs before it can lay anything out. Cheap after the first
// call: the result is cached on the document until its version changes.
export const GET = withDataroomAuth(
  async (request, { db, params, capabilities }) => {
    const { id } = params;

    const document = await db.collection('dataroom_documents').findOne(
      { _id: new ObjectId(id), isDeleted: { $ne: true } },
      { projection: { mimeType: 1, fileSize: 1, currentVersion: 1, pageInfo: 1, roomId: 1,
        storageProvider: 1, storageBucket: 1, fileId: 1, blobUrl: 1, blobPathname: 1, utKey: 1 } },
    );

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.mimeType !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDFs can be rendered as pages', renderable: false },
        { status: 415 },
      );
    }

    try {
      const info = await getPageInfo(db, document);
      return NextResponse.json({
        renderable: true,
        numPages: info.numPages,
        pages: info.pages,
        // The client needs to know whether it may fall back to streaming the
        // file, because for a reader without `download` there is no fallback —
        // an unrenderable document is simply unavailable to them.
        canDownload: !!capabilities?.canDownload,
      });
    } catch (error) {
      if (error.code === 'TOO_LARGE') {
        return NextResponse.json(
          {
            error: `Documents over ${Math.round(MAX_RENDERABLE_BYTES / 1024 / 1024)}MB cannot be rendered page by page`,
            renderable: false,
          },
          { status: 413 },
        );
      }
      if (error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
      }
      console.error('Page info failed:', error);
      return NextResponse.json(
        { error: 'This document could not be read', renderable: false },
        { status: 500 },
      );
    }
  },
  {
    requires: 'view',
    resource: { type: 'document', param: 'id' },
    allowExternal: true,
    allowShare: true,
    capabilities: true,
  },
);
