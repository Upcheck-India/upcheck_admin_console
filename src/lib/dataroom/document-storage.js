import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import {
  getActiveProvider,
  getProviderForRef,
  placementFor,
  SCOPES,
} from '../storage/index.js';

/**
 * The data room's view of lib/storage.
 *
 * Documents predate the pluggable providers: they were written straight into
 * the `dataroom_files` GridFS bucket with no `storageProvider` field at all.
 * Those records must keep working, so every read goes through storageRef(),
 * which fills in what an old document does not say — GridFS, in the data
 * room's own bucket. Without that default an old document would be looked up
 * in the App Store's bucket and appear to have vanished.
 */
export function storageRef(document) {
  return {
    storageProvider: document.storageProvider || 'gridfs',
    storageBucket: document.storageBucket || SCOPES.dataroom.bucket,
    fileId: document.fileId,
    blobUrl: document.blobUrl,
    blobPathname: document.blobPathname,
    utKey: document.utKey,
  };
}

/**
 * Stream a file into whichever provider is currently active and return the
 * storage fields to record on the document.
 *
 * `file` is a web File from formData. Its .stream() is piped through rather
 * than buffered with arrayBuffer(), so a 100MB upload does not have to exist
 * in the function's memory in one piece. (UploadThing's own SDK still buffers
 * internally — see the note in its module — but that is its constraint, not
 * one this layer imposes on the other two.)
 */
export async function storeDocumentFile(db, file, { roomId, user }) {
  const provider = await getActiveProvider(db);
  const upload = provider.startUpload(db, {
    filename: file.name,
    contentType: file.type,
    ...placementFor('dataroom', String(roomId)),
    metadata: {
      roomId,
      uploadedBy: user._id.toString(),
      uploadedByEmail: user.email,
      originalName: file.name,
    },
  });

  let result;
  try {
    await pipeline(Readable.fromWeb(file.stream()), upload.sink);
    result = await upload.finalize();
  } catch (error) {
    // A half-written object is worse than none: it occupies quota and nothing
    // references it, so nothing will ever clean it up.
    await upload.cleanup(result).catch(() => {});
    throw error;
  }
  return result;
}

/** Open a read stream for a document, honouring an HTTP byte range. */
export function openDocumentStream(db, document, range) {
  return getProviderForRef(storageRef(document)).getDownloadStream(db, storageRef(document), range);
}

/** Delete a document's bytes from whichever provider actually holds them. */
export function deleteDocumentFile(db, document) {
  return getProviderForRef(storageRef(document)).deleteFile(db, storageRef(document));
}

/**
 * Parse an HTTP Range header. Only the single-range form is supported, which
 * is the only form pdf.js and every browser media element actually send.
 * Returns null for absent/unparseable, { unsatisfiable: true } for a range
 * that falls outside the file (which must be answered with 416, not 200).
 */
export function parseRange(header, size) {
  if (!header || !size) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;

  const [, rawStart, rawEnd] = m;
  if (rawStart === '' && rawEnd === '') return null;

  let start;
  let end;
  if (rawStart === '') {
    // `bytes=-N` — the trailing N bytes. pdf.js uses this to read the xref
    // table at the end of the file before fetching anything else.
    const suffix = Number(rawEnd);
    if (!suffix) return { unsatisfiable: true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return { unsatisfiable: true };
  }
  return { start, end };
}
