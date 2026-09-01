// Binaries whose database record is being removed but whose bytes could not be.
//
// Companion to the realtime service's src/appstore/orphans.js — same
// `appstore_orphans` collection in the same database, and that service's sweep
// (which runs on every upload) retries whatever is written here. Only the
// recording half lives on this side, because this side has no long-lived
// process to sweep from.
//
// Deleting an app removes its version records, so a file whose delete failed
// would otherwise have nothing left pointing at it. Refusing to delete the app
// would be worse than an orphan; recording the reference keeps both.

const COLLECTION = 'appstore_orphans';

function storageRef(ref) {
  return {
    storageProvider: ref.storageProvider || null,
    fileId: ref.fileId || null,
    blobUrl: ref.blobUrl || null,
    blobPathname: ref.blobPathname || null,
    utKey: ref.utKey || null,
  };
}

/**
 * Delete a version's bytes, recording the reference if that fails.
 * Never throws — the caller is mid-delete and must be able to finish.
 */
export async function deleteVersionFile(db, ref, provider, context = {}) {
  try {
    await provider.deleteFile(db, ref);
    return true;
  } catch (err) {
    console.error(
      `[appstore] delete failed for ${ref.storageProvider || 'gridfs'}; recorded as orphan:`,
      err?.message || err,
    );
    try {
      await db.collection(COLLECTION).updateOne(
        { ref: storageRef(ref) },
        {
          $set: {
            ref: storageRef(ref),
            ...context,
            lastError: String(err?.message || err).slice(0, 500),
            lastTriedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
          $inc: { attempts: 1 },
        },
        { upsert: true },
      );
    } catch (writeErr) {
      console.error('[appstore] could not record orphan:', writeErr?.message);
    }
    return false;
  }
}
