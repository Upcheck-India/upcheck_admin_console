import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';

// The original App Store binary storage backend — kept available as a
// selectable option (no external account/credentials needed, since it
// just uses the same MongoDB the rest of the app already talks to) even
// though Vercel Blob is now the default.
export const PROVIDER_ID = 'gridfs';
export const PROVIDER_LABEL = 'MongoDB GridFS (built-in, no extra setup)';

function getBucket(db) {
  // Default GridFS chunk size is 255KB, which turns a 100MB+ APK into
  // 400+ separate chunk-document inserts. 1MB chunks cut that overhead.
  return new GridFSBucket(db, { bucketName: 'appstore_apks', chunkSizeBytes: 1024 * 1024 });
}

/** Starts a GridFS upload. `sink` is a Writable the caller's stream
 * pipeline writes into; `finalize()` resolves once the write is flushed. */
export function startUpload(db, { filename, contentType, appId, version, uploadedBy }) {
  const bucket = getBucket(db);
  const sink = bucket.openUploadStream(filename, {
    contentType,
    metadata: { appId, version, uploadedBy, uploadedAt: new Date() },
  });
  return {
    sink,
    finalize: async () => ({ storageProvider: PROVIDER_ID, fileId: sink.id.toString() }),
    cleanup: async () => {
      if (sink.id) await bucket.delete(sink.id).catch(() => {});
    },
  };
}

export async function getDownloadStream(db, version) {
  if (!version.fileId || !ObjectId.isValid(version.fileId)) return null;
  const bucket = getBucket(db);
  const files = await bucket.find({ _id: new ObjectId(version.fileId) }).toArray();
  if (files.length === 0) return null;
  const nodeStream = bucket.openDownloadStream(new ObjectId(version.fileId));
  return { webStream: Readable.toWeb(nodeStream), size: files[0].length, contentType: files[0].contentType };
}

export async function deleteFile(db, version) {
  if (!version.fileId || !ObjectId.isValid(version.fileId)) return;
  const bucket = getBucket(db);
  await bucket.delete(new ObjectId(version.fileId)).catch(() => {});
}

export async function getUsage(db) {
  const stats = await db.collection('appstore_apks.files')
    .aggregate([{ $group: { _id: null, totalBytes: { $sum: '$length' }, fileCount: { $sum: 1 } } }])
    .toArray();
  const s = stats[0] || { totalBytes: 0, fileCount: 0 };
  return { provider: PROVIDER_ID, label: PROVIDER_LABEL, totalBytes: s.totalBytes, fileCount: s.fileCount, limitBytes: null, configured: true };
}
