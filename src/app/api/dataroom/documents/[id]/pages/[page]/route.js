import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { withDataroomAuth } from '../../../../../../../lib/dataroom/withDataroomAuth';
import { openDocumentStream } from '../../../../../../../lib/dataroom/document-storage';
import {
  getRenderedPage,
  normalizeWidth,
  watermarkPage,
} from '../../../../../../../lib/dataroom/page-render';

/**
 * GET /api/dataroom/documents/[id]/pages/[page]?w=1400
 *
 * One page of a document, as a watermarked PNG. This is the path a reader who
 * may view but not download takes, and the source PDF never travels it.
 *
 * The watermark names the reader and the moment. That is the point: a
 * screenshot or a photograph of the screen carries the identity of whoever
 * took it, which is the only deterrent that survives a reader who is
 * determined and holds a camera.
 */
export const GET = withDataroomAuth(
  async (request, { user, db, params, capabilities, share }) => {
    const { id, page } = params;

    const pageNumber = Number.parseInt(page, 10);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      return NextResponse.json({ error: 'Invalid page number' }, { status: 400 });
    }

    const width = normalizeWidth(new URL(request.url).searchParams.get('w'));

    const document = await db
      .collection('dataroom_documents')
      .findOne({ _id: new ObjectId(id), isDeleted: { $ne: true } });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.mimeType !== 'application/pdf') {
      return NextResponse.json({ error: 'Not a PDF' }, { status: 415 });
    }

    let render;
    try {
      render = await getRenderedPage(db, document, pageNumber, width);
    } catch (error) {
      if (error.code === 'OUT_OF_RANGE') {
        return NextResponse.json({ error: 'Page out of range' }, { status: 404 });
      }
      if (error.code === 'TOO_LARGE' || error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      console.error('Page render failed:', error);
      return NextResponse.json({ error: 'This page could not be rendered' }, { status: 500 });
    }

    // The cached render is stored through the same provider as everything else,
    // so it is read back the same way.
    const stream = await openDocumentStream(db, render);
    if (!stream) {
      return NextResponse.json({ error: 'Rendered page is missing' }, { status: 404 });
    }

    const chunks = [];
    for await (const chunk of stream.nodeStream || stream.webStream) {
      chunks.push(Buffer.from(chunk));
    }

    const marked = await watermarkPage(Buffer.concat(chunks), {
      text: watermarkFor(user, share, document),
      width: render.pixelWidth,
      height: render.pixelHeight,
    });

    return new NextResponse(marked, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(marked.length),
        // Private, not public: the watermark is personal to this reader, so a
        // shared cache holding it would serve one reader's name to another.
        // `private` still lets the reader's own browser reuse it while paging
        // back and forth, which is most of the benefit.
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'X-Dataroom-Can-Download': String(!!capabilities?.canDownload),
        'X-Dataroom-Can-Print': String(!!capabilities?.canPrint),
      },
    });
  },
  {
    requires: 'view',
    resource: { type: 'document', param: 'id' },
    allowExternal: true,
    allowShare: true,
    capabilities: true,
  },
);

/**
 * Who this copy was served to. A share-link visitor may have given no name at
 * all, in which case the link itself is the closest thing to an identity there
 * is — better than an anonymous "CONFIDENTIAL" that identifies nobody.
 */
function watermarkFor(user, share, document) {
  const who = user.email || (share ? `share ${String(share._id).slice(-6)}` : 'unidentified');
  const when = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return `${who} · ${when} · ${document.roomId ? 'confidential' : ''}`.trim();
}
