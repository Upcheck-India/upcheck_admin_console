import { Writable } from 'stream';
import { UTApi, UTFile } from 'uploadthing/server';

// Third selectable App Store binary storage backend. UploadThing's server
// SDK (UTApi.uploadFiles) takes a whole File/Blob object rather than a
// stream, so unlike the other two providers this one buffers the request
// body in memory before uploading — bounded by the same MAX_APK_SIZE_BYTES
// cap the upload route already enforces, so worst case is one ~250MB
// buffer, not unbounded. If this becomes the primary provider it'd be
// worth switching to UploadThing's own direct-upload/presigned flow
// instead of this buffered relay.
export const PROVIDER_ID = 'uploadthing';
export const PROVIDER_LABEL = 'UploadThing (free tier: 2GB storage)';

let cachedApi = null;
function getApi() {
  if (!cachedApi) cachedApi = new UTApi();
  return cachedApi;
}

export function isConfigured() {
  return !!process.env.UPLOADTHING_TOKEN;
}

export function startUpload(_db, { filename, contentType, appId, version }) {
  const chunks = [];
  const sink = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk);
      cb();
    },
  });
  return {
    sink,
    finalize: async () => {
      const buffer = Buffer.concat(chunks);
      const file = new UTFile([buffer], filename, {
        type: contentType,
        customId: `${appId}-${version}-${Date.now()}`,
      });
      const result = await getApi().uploadFiles(file);
      if (result.error) {
        throw new Error(result.error.message || 'UploadThing upload failed');
      }
      return { storageProvider: PROVIDER_ID, utKey: result.data.key, blobUrl: result.data.ufsUrl || result.data.url };
    },
    cleanup: async (partialResult) => {
      if (partialResult?.utKey) await getApi().deleteFiles(partialResult.utKey).catch(() => {});
    },
  };
}

export async function getDownloadStream(_db, version) {
  if (!version.blobUrl) return null;
  const res = await fetch(version.blobUrl);
  if (!res.ok || !res.body) return null;
  return {
    webStream: res.body,
    size: Number(res.headers.get('content-length')) || null,
    contentType: res.headers.get('content-type') || 'application/vnd.android.package-archive',
  };
}

export async function deleteFile(_db, version) {
  if (version.utKey) await getApi().deleteFiles(version.utKey).catch(() => {});
}

export async function getUsage() {
  if (!isConfigured()) {
    return { provider: PROVIDER_ID, label: PROVIDER_LABEL, totalBytes: 0, fileCount: 0, limitBytes: null, configured: false };
  }
  const info = await getApi().getUsageInfo();
  return { provider: PROVIDER_ID, label: PROVIDER_LABEL, totalBytes: info.appTotalBytes, fileCount: info.filesUploaded, limitBytes: info.limitBytes, configured: true };
}
