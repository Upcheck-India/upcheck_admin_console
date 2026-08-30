// Pluggable binary storage. Vercel Blob is the default provider; GridFS (the
// original, MongoDB-backed implementation) and UploadThing are selectable
// alternates via appstore_settings.
//
// Every provider module exports the same shape:
//   startUpload(db, { filename, contentType, ...placement })
//     -> { sink: Writable, finalize: () => Promise<storageFields>, cleanup: (partial) => Promise<void> }
//   getDownloadStream(db, ref, range) -> { webStream, nodeStream?, size, contentType, range } | null
//   deleteFile(db, ref) -> Promise<void>
//   getUsage(db, scopeOptions) -> { provider, label, totalBytes, fileCount, limitBytes, configured }
//
// `ref` is whatever record owns the file — an App Store version sub-document,
// or a data room document. Each is tagged at upload time with the fields the
// provider needs to find its bytes again (`storageProvider` plus, depending on
// the provider, `fileId`/`storageBucket`, `blobUrl`/`blobPathname`, `utKey`).
// That is what lets an OLD file still be read and deleted through the provider
// it was actually stored with, even after the active setting has changed.
//
// `placement` and `scopeOptions` name the area of the app a file belongs to —
// see SCOPES below. They exist so the App Store and the data room can share
// these providers without sharing a namespace.
import * as gridfs from './gridfs.js';
import * as vercelBlob from './vercelBlob.js';
import * as uploadthing from './uploadthing.js';

export const PROVIDERS = {
  [vercelBlob.PROVIDER_ID]: vercelBlob,
  [gridfs.PROVIDER_ID]: gridfs,
  [uploadthing.PROVIDER_ID]: uploadthing,
};

export const DEFAULT_PROVIDER_ID = vercelBlob.PROVIDER_ID;

/** Per-area namespacing: a GridFS bucket and an object-store path prefix. */
export const SCOPES = {
  appstore: { bucket: 'appstore_apks', prefix: 'appstore' },
  dataroom: { bucket: 'dataroom_files', prefix: 'dataroom' },
};

/** Placement fields to spread into a startUpload call for a given area. */
export function placementFor(scope, key) {
  const s = SCOPES[scope] || SCOPES.appstore;
  return { bucket: s.bucket, prefix: s.prefix, key };
}

export function getProvider(providerId) {
  return PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER_ID];
}

/** Which provider new uploads should use — the admin-selected setting if
 * valid, else the default. Falls back to GridFS if the selected provider
 * is missing its credentials, so a misconfigured setting never hard-fails
 * an upload. */
export async function getActiveProvider(db) {
  const settings = await db.collection('appstore_settings').findOne({});
  const selectedId = settings?.storageProvider;
  const selected = selectedId && PROVIDERS[selectedId] ? PROVIDERS[selectedId] : PROVIDERS[DEFAULT_PROVIDER_ID];
  if (selected.isConfigured && !selected.isConfigured()) {
    return gridfs;
  }
  return selected;
}

/** The provider a specific already-uploaded file was stored with — records
 * predating this feature have no storageProvider field and were always
 * GridFS. */
export function getProviderForRef(ref) {
  return getProvider(ref?.storageProvider || gridfs.PROVIDER_ID);
}

export async function getAllProvidersUsage(db, scope = 'appstore') {
  const s = SCOPES[scope] || SCOPES.appstore;
  return Promise.all(
    Object.values(PROVIDERS).map(async (mod) => {
      try {
        return await mod.getUsage(db, s);
      } catch (error) {
        return { provider: mod.PROVIDER_ID, label: mod.PROVIDER_LABEL, error: error.message, configured: false };
      }
    })
  );
}
