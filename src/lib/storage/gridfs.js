import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';

// MongoDB-backed binary storage — a selectable option for both the App Store
// and the data room (no external account or credentials needed, since it uses
// the same MongoDB the rest of the app already talks to).
export const PROVIDER_ID = 'gridfs';
export const PROVIDER_LABEL = 'MongoDB GridFS (built-in, no extra setup)';

// Each area of the app keeps its files in its own bucket. The bucket a file
// lives in is recorded on the file's own record at upload time, so a file
// stays readable no matter what the current default is — the same reason
// `storageProvider` is recorded.
export const DEFAULT_BUCKET = 'appstore_apks';

function getBucket(db, bucketName = DEFAULT_BUCKET) {
  // The GridFS default chunk size is 255KB, which turns a 100MB file into
  // 400+ separate chunk-document inserts. 1MB chunks cut that overhead by
  // four. This affects writes only: files already stored at 255KB read back
  // exactly as before.
  return new GridFSBucket(db, { bucketName, chunkSizeBytes: 1024 * 1024 });
}

/** Starts a GridFS upload. `sink` is a Writable the caller's stream
 * pipeline writes into; `finalize()` resolves once the write is flushed. */
export function startUpload(db, { filename, contentType, bucket, metadata }) {
  const bucketName = bucket || DEFAULT_BUCKET;
  const gridBucket = getBucket(db, bucketName);
  const sink = gridBucket.openUploadStream(filename, {
    contentType,
    metadata: { ...metadata, uploadedAt: new Date() },
  });
  return {
    sink,
    finalize: async () => ({
      storageProvider: PROVIDER_ID,
      fileId: sink.id,
      storageBucket: bucketName,
    }),
    cleanup: async () => {
      if (sink.id) await gridBucket.delete(sink.id).catch(() => {});
    },
  };
}

/** `range`, if given, is `{ start, end }` byte offsets (both inclusive,
 * HTTP Range header convention). GridFS supports this precisely via
 * openDownloadStream's own start/end options, so a range costs the range
 * rather than a read-and-discard from the front of the file. */
export async function getDownloadStream(db, ref, range) {
  if (!ref.fileId || !ObjectId.isValid(ref.fileId)) return null;
  const fileId = new ObjectId(ref.fileId);
  const bucket = getBucket(db, ref.storageBucket);
  const files = await bucket.find({ _id: fileId }).toArray();
  if (files.length === 0) return null;
  const totalSize = files[0].length;

  if (range) {
    const end = Math.min(range.end, totalSize - 1);
    // GridFS `end` is exclusive; HTTP Range `end` is inclusive.
    const nodeStream = bucket.openDownloadStream(fileId, { start: range.start, end: end + 1 });
    return {
      nodeStream,
      webStream: Readable.toWeb(nodeStream),
      size: end - range.start + 1,
      contentType: files[0].contentType,
      range: { start: range.start, end, total: totalSize },
    };
  }

  const nodeStream = bucket.openDownloadStream(fileId);
  return {
    nodeStream,
    webStream: Readable.toWeb(nodeStream),
    size: totalSize,
    contentType: files[0].contentType,
    range: null,
  };
}

export async function deleteFile(db, ref) {
  if (!ref.fileId || !ObjectId.isValid(ref.fileId)) return;
  await getBucket(db, ref.storageBucket).delete(new ObjectId(ref.fileId)).catch(() => {});
}

export async function getUsage(db, { bucket = DEFAULT_BUCKET } = {}) {
  const stats = await db.collection(`${bucket}.files`)
    .aggregate([{ $group: { _id: null, totalBytes: { $sum: '$length' }, fileCount: { $sum: 1 } } }])
    .toArray();
  const s = stats[0] || { totalBytes: 0, fileCount: 0 };
  return { provider: PROVIDER_ID, label: PROVIDER_LABEL, totalBytes: s.totalBytes, fileCount: s.fileCount, limitBytes: null, configured: true };
}
