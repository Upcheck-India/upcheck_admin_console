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

function pathFor(appId, version, filename) {
  const safeFilename = (filename || 'app.apk').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `appstore/${appId}/${version}-${Date.now()}-${safeFilename}`;
}

export function startUpload(_db, { filename, contentType, appId, version }) {
  const pathname = pathFor(appId, version, filename);
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

export async function getDownloadStream(_db, version) {
  if (!version.blobUrl && !version.blobPathname) return null;
  const result = await get(version.blobUrl || version.blobPathname, { access: 'private', token: TOKEN });
  if (!result || result.statusCode !== 200) return null;
  return { webStream: result.stream, size: result.blob.size, contentType: result.blob.contentType };
}

export async function deleteFile(_db, version) {
  const target = version.blobUrl || version.blobPathname;
  if (target) await del(target, { token: TOKEN }).catch(() => {});
}

export async function getUsage() {
  if (!isConfigured()) {
    return { provider: PROVIDER_ID, label: PROVIDER_LABEL, totalBytes: 0, fileCount: 0, limitBytes: null, configured: false };
  }
  let totalBytes = 0;
  let fileCount = 0;
  let cursor;
  do {
    const page = await list({ token: TOKEN, prefix: 'appstore/', cursor, limit: 1000 });
    totalBytes += page.blobs.reduce((sum, b) => sum + b.size, 0);
    fileCount += page.blobs.length;
    cursor = page.cursor;
  } while (cursor);
  return { provider: PROVIDER_ID, label: PROVIDER_LABEL, totalBytes, fileCount, limitBytes: 1024 * 1024 * 1024, configured: true };
}
