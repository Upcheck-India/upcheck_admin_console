import { Readable } from 'node:stream';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ObjectId } from 'mongodb';
import {
  deleteDocumentFile,
  openDocumentStream,
  storeDocumentStream,
} from './document-storage';

/**
 * Server-side page rendering.
 *
 * WHY THIS EXISTS
 * ---------------
 * The canvas viewer stopped the browser's PDF plugin from handing the reader a
 * Download button, which made `print` without `download` mean something to an
 * ordinary user. It did not make it true. The file still crossed the wire to
 * be rendered, so anyone willing to open devtools could reassemble it from the
 * range responses.
 *
 * Rendering the pages here closes that: a reader who may view but not download
 * receives PNGs and never the PDF. There is no file in the browser to
 * reassemble, and the watermark is in the pixels rather than in an overlay
 * that a stylesheet edit removes.
 *
 * WHAT IT COSTS, HONESTLY
 * -----------------------
 * Text stops being selectable and searchable, and a page image is larger than
 * the slice of PDF it came from. That is a real downgrade, which is why the
 * viewer only uses this mode for readers who lack `download` — for everyone
 * else the file is theirs anyway, so degrading their reading experience buys
 * nothing.
 *
 * CACHING
 * -------
 * Rasterising is the expensive half and the watermark is the cheap half, so
 * they are split: the base render is cached per (document, version, page,
 * width) and reused, while the per-reader watermark is composited onto it on
 * every request. Baking the watermark into the cache would make every cache
 * entry single-reader and defeat the point of having one.
 */

// A page render loads the whole PDF into memory. Beyond this, the honest
// answer is "this document cannot be protected this way" rather than an
// out-of-memory crash halfway through someone's reading session.
export const MAX_RENDERABLE_BYTES = 40 * 1024 * 1024;

export const RENDER_WIDTHS = [900, 1400, 2000];
export const DEFAULT_RENDER_WIDTH = 1400;

/** Snap a requested width to the small set we cache, so the cache stays small. */
export function normalizeWidth(requested) {
  const asked = Number(requested) || DEFAULT_RENDER_WIDTH;
  return RENDER_WIDTHS.reduce((best, w) =>
    Math.abs(w - asked) < Math.abs(best - asked) ? w : best,
  );
}

/**
 * pdf.js and sharp are both heavy and neither is needed unless someone
 * actually opens a protected document, so they load on first use.
 *
 * pdf.js needs a canvas implementation in Node. The legacy build is the one
 * that runs outside a browser; it falls back to a same-thread "fake worker"
 * rather than requiring a worker file on disk.
 */
let depsPromise = null;
function loadDeps() {
  if (!depsPromise) {
    depsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('@napi-rs/canvas'),
      import('sharp'),
    ]).then(([pdfjs, canvas, sharp]) => ({
      pdfjs,
      canvas,
      sharp: sharp.default || sharp,
    }));
  }
  return depsPromise;
}

/** Read a document's bytes into a buffer, refusing anything oversized. */
async function loadPdfBuffer(db, document) {
  if (document.fileSize && document.fileSize > MAX_RENDERABLE_BYTES) {
    const error = new Error('Document is too large to render server-side');
    error.code = 'TOO_LARGE';
    throw error;
  }

  const stream = await openDocumentStream(db, document);
  if (!stream) {
    const error = new Error('File not found in storage');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of stream.nodeStream || streamToAsyncIterable(stream.webStream)) {
    total += chunk.length;
    // Re-checked while reading: fileSize is denormalised and may be wrong or
    // absent, and the cap has to hold against the actual bytes.
    if (total > MAX_RENDERABLE_BYTES) {
      stream.nodeStream?.destroy();
      const error = new Error('Document is too large to render server-side');
      error.code = 'TOO_LARGE';
      throw error;
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function* streamToAsyncIterable(webStream) {
  const reader = webStream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Where pdf.js finds the Type1 fonts every PDF assumes are present but does
 * not embed — Helvetica, Times, Courier.
 *
 * Three things here are load-bearing, all of them learned by watching pages
 * come out blank (scripts/test-page-render.mjs pins them):
 *
 *   - The path is absolute, resolved from this module. A relative path is
 *     resolved against the working directory, which is the repo root in
 *     development and something else entirely in a deployed function.
 *   - It is a plain filesystem path, NOT a file:// URL. pdf.js's Node data
 *     factory reads it with fs, and a file:// URL fails silently: the fonts
 *     never load, no error is raised, and every glyph is simply skipped.
 *   - It ends with a separator, because pdf.js concatenates the filename
 *     straight onto it.
 *
 * A page whose only content is text renders completely blank when this is
 * wrong, and nothing anywhere reports an error.
 */
let fontPaths = null;
function resolveFontPaths() {
  if (!fontPaths) {
    const require_ = createRequire(import.meta.url);
    const root = path.dirname(require_.resolve('pdfjs-dist/package.json'));
    fontPaths = {
      standardFontDataUrl: path.join(root, 'standard_fonts') + path.sep,
      cMapUrl: path.join(root, 'cmaps') + path.sep,
    };
  }
  return fontPaths;
}

/** Open a PDF with pdf.js in Node. */
async function openPdf(db, document) {
  const { pdfjs } = await loadDeps();
  const data = await loadPdfBuffer(db, document);
  const { standardFontDataUrl, cMapUrl } = resolveFontPaths();

  return pdfjs.getDocument({
    data: new Uint8Array(data),
    standardFontDataUrl,
    cMapUrl,
    cMapPacked: true,
    // There is no system font stack in a serverless function, so asking for
    // one gets substitutions rather than the real thing.
    useSystemFonts: false,
  }).promise;
}

/**
 * Page count and per-page aspect ratios, cached on the document.
 *
 * The viewer needs these before it can lay anything out, and re-opening the
 * PDF to count pages on every load would make the first paint wait for a full
 * parse of a document nobody has scrolled yet.
 */
export async function getPageInfo(db, document) {
  const version = document.currentVersion || 1;
  if (document.pageInfo?.version === version) return document.pageInfo;

  const pdf = await openPdf(db, document);
  try {
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const { width, height } = page.getViewport({ scale: 1 });
      pages.push({ width: Math.round(width), height: Math.round(height) });
    }

    const info = { version, numPages: pdf.numPages, pages };
    await db
      .collection('dataroom_documents')
      .updateOne({ _id: document._id }, { $set: { pageInfo: info } });
    return info;
  } finally {
    await pdf.destroy();
  }
}

/**
 * The cached base render for one page, as a storage reference. Rasterises and
 * stores it on first request.
 */
export async function getRenderedPage(db, document, pageNumber, width) {
  const version = document.currentVersion || 1;
  const key = {
    documentId: document._id,
    version,
    page: pageNumber,
    width,
  };

  const cached = await db.collection('dataroom_page_renders').findOne(key);
  if (cached) return cached;

  const { canvas: canvasLib } = await loadDeps();
  const pdf = await openPdf(db, document);

  try {
    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      const error = new Error('Page out of range');
      error.code = 'OUT_OF_RANGE';
      throw error;
    }

    const page = await pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: width / base.width });

    const surface = canvasLib.createCanvas(
      Math.round(viewport.width),
      Math.round(viewport.height),
    );
    const context = surface.getContext('2d');

    // PDF pages assume paper. Without this, anything transparent in the page
    // renders onto black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, surface.width, surface.height);

    await page.render({ canvasContext: context, viewport }).promise;

    const png = surface.toBuffer('image/png');

    const storage = await storeDocumentStream(db, Readable.from(png), {
      filename: `${document._id}-v${version}-p${pageNumber}-${width}.png`,
      contentType: 'image/png',
      roomId: document.roomId,
      // A render is a derivative of the document, not something a person
      // uploaded, so it is attributed to the system rather than to whichever
      // reader happened to open the page first.
      user: { _id: 'system', email: 'system@upcheck' },
    });

    const record = {
      ...key,
      ...storage,
      bytes: png.length,
      pixelWidth: surface.width,
      pixelHeight: surface.height,
      renderedAt: new Date(),
    };

    // Two readers opening the same page at once both render it. Whoever loses
    // the unique index re-reads the winner's record and drops their own copy,
    // rather than leaving a second orphaned object in storage.
    try {
      await db.collection('dataroom_page_renders').insertOne(record);
      return record;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const winner = await db.collection('dataroom_page_renders').findOne(key);
      if (winner) return winner;
      return record;
    }
  } finally {
    await pdf.destroy();
  }
}

/**
 * Composite a diagonal watermark onto a rendered page.
 *
 * In the pixels, not in an overlay div: an overlay is one devtools edit away
 * from being gone, and a screenshot of the page without it is then clean.
 */
export async function watermarkPage(pageBuffer, { text, width, height }) {
  if (!text) return pageBuffer;

  const { sharp } = await loadDeps();

  // Scaled to the page rather than fixed, so it reads the same on a wide
  // landscape render as on a narrow portrait one.
  const fontSize = Math.max(18, Math.round(width / 26));
  const step = Math.round(fontSize * 9);
  const rows = [];

  for (let y = -height; y < height * 2; y += step) {
    for (let x = -width; x < width * 2; x += step * 1.6) {
      rows.push(
        `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${fontSize}" ` +
          `fill="#0f172a" fill-opacity="0.10" transform="rotate(-30 ${x} ${y})">` +
          `${escapeXml(text)}</text>`,
      );
    }
  }

  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rows.join('')}</svg>`,
  );

  return sharp(pageBuffer)
    .composite([{ input: svg, top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Drop every cached render for a document — call when its bytes change. */
export async function invalidateRenders(db, documentId) {
  const id = documentId instanceof ObjectId ? documentId : new ObjectId(documentId);

  // The stored images go with the records. Dropping only the rows would leave
  // one orphaned object per page per width in whichever provider holds them.
  const renders = await db.collection('dataroom_page_renders').find({ documentId: id }).toArray();
  for (const render of renders) {
    await deleteDocumentFile(db, render).catch((err) =>
      console.error('Failed to delete cached page render:', err),
    );
  }

  await db.collection('dataroom_page_renders').deleteMany({ documentId: id });
  await db
    .collection('dataroom_documents')
    .updateOne({ _id: id }, { $unset: { pageInfo: '' } });
}
