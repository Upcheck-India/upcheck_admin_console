import { put, get, del, list } from '@vercel/blob';
import { PassThrough } from 'stream';

// Default App Store binary storage backend. Vercel Blob is object storage
// with a much higher practical size ceiling than stuffing binaries into
// MongoDB (GridFS), and its own CDN-backed read path — the tradeoff versus
// a true client-direct upload (browser/Node only, per Vercel's docs) is
// that our server still relays the upload bytes through to Blob, same as
// it did for GridFS; we didn't hand-roll Vercel's undocumented internal
// client-upload wire protocol to make mobile bypass the origin entirely,
// since that's not an officially supported integration path for React
// Native and would be fragile to depend on.
export const PROVIDER_ID = 'vercel-blob';
export const PROVIDER_LABEL = 'Vercel Blob (free tier: 1GB storage / 10GB bandwidth per month)';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

export function isConfigured() {
  return !!TOKEN;
}

// Every stored object is namespaced by the area that owns it, so usage can be
// reported per area and one area's files can never collide with another's.
export const DEFAULT_PREFIX = 'appstore';

function pathFor(prefix, key, filename) {
  const safeFilename = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${prefix}/${key}/${Date.now()}-${safeFilename}`;
}

export function startUpload(_db, { filename, contentType, prefix = DEFAULT_PREFIX, key = 'misc' }) {
  const pathname = pathFor(prefix, key, filename);
  const sink = new PassThrough();
  const putPromise = put(pathname, sink, {
    access: 'private',
    contentType,
    token: TOKEN,
    addRandomSuffix: false,
  });
  return {
    sink,
    finalize: async () => {
      const result = await putPromise;
      return { storageProvider: PROVIDER_ID, blobUrl: result.url, blobPathname: result.pathname };
    },
    cleanup: async (partialResult) => {
      const url = partialResult?.blobUrl;
      if (url) await del(url, { token: TOKEN }).catch(() => {});
      // If put() itself never resolved (e.g. the pipeline failed before
      // finalize ran), there's nothing addressable to clean up — Vercel
      // Blob never received a complete object in that case.
    },
  };
}

/** `range`, if given, is `{ start, end }` byte offsets (both inclusive).
 * Forwarded as a plain Range header to the underlying fetch — the SDK
 * doesn't have first-class range support (its GetBlobResult type only
 * documents 200/304), so this is best-effort: if the backend honors it we
 * report a real partial range, otherwise we detect the fallback (returned
 * size equals the full file) and just serve the whole thing as a normal
 * 200 response, which is a safe, spec-correct thing for a resumable
 * downloader to see. */
export async function getDownloadStream(_db, ref, range) {
  if (!ref.blobUrl && !ref.blobPathname) return null;
  const headers = range ? { Range: `bytes=${range.start}-${range.end}` } : undefined;
  const result = await get(ref.blobUrl || ref.blobPathname, { access: 'private', token: TOKEN, headers });
  if (!result || result.statusCode !== 200) return null;

  const total = result.blob.size;
  const contentRange = result.headers?.get?.('content-range');
  if (range && contentRange) {
    // The backend actually honored the Range request.
    return { webStream: result.stream, size: range.end - range.start + 1, contentType: result.blob.contentType, range: { start: range.start, end: range.end, total } };
  }
  // No partial response — either no range was requested, or the backend
  // ignored ours and returned the whole file; either way, serve it as a
  // normal full 200 response (safe, spec-correct for the client to see).
  return { webStream: result.stream, size: total, contentType: result.blob.contentType, range: null };
}

export async function deleteFile(_db, ref) {
  const target = ref.blobUrl || ref.blobPathname;
  // No reference is not a success — that is how a file becomes unreachable.
  if (!target) throw new Error('ref has no blobUrl/blobPathname to delete');
  await del(target, { token: TOKEN }); // idempotent; errors must propagate
}

export async function getUsage(_db, { prefix = DEFAULT_PREFIX } = {}) {
  if (!isConfigured()) {
    return { provider: PROVIDER_ID, label: PROVIDER_LABEL, totalBytes: 0, fileCount: 0, limitBytes: null, configured: false };
  }
  let totalBytes = 0;
  let fileCount = 0;
  let cursor;
  do {
    const page = await list({ token: TOKEN, prefix: `${prefix}/`, cursor, limit: 1000 });
    totalBytes += page.blobs.reduce((sum, b) => sum + b.size, 0);
    fileCount += page.blobs.length;
    cursor = page.cursor;
  } while (cursor);
  return { provider: PROVIDER_ID, label: PROVIDER_LABEL, totalBytes, fileCount, limitBytes: 1024 * 1024 * 1024, configured: true };
}
