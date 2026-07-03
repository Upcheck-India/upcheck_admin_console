// App Store binary storage — pluggable backend. Vercel Blob is the default
// (primary) provider; GridFS (the original, MongoDB-backed implementation)
// and UploadThing are selectable alternates via appstore_settings.
//
// Every provider module exports the same shape:
//   startUpload(db, { filename, contentType, appId, version, uploadedBy })
//     -> { sink: Writable, finalize: () => Promise<versionStorageFields>, cleanup: (partial) => Promise<void> }
//   getDownloadStream(db, version) -> { webStream, size, contentType } | null
//   deleteFile(db, version) -> Promise<void>
//   getUsage(db) -> { provider, label, totalBytes, fileCount, limitBytes, configured }
//
// `version` here is a version sub-document from appstore_apps.versions —
// each one is tagged with `storageProvider` at upload time, so deleting or
// downloading an OLD version always uses the provider it was actually
// stored with, even if the active setting has since changed.
import * as gridfs from './gridfs.js';
import * as vercelBlob from './vercelBlob.js';
import * as uploadthing from './uploadthing.js';

export const PROVIDERS = {
  [vercelBlob.PROVIDER_ID]: vercelBlob,
  [gridfs.PROVIDER_ID]: gridfs,
  [uploadthing.PROVIDER_ID]: uploadthing,
};

export const DEFAULT_PROVIDER_ID = vercelBlob.PROVIDER_ID;

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

/** The provider a specific already-uploaded version was stored with —
 * versions predating this feature have no storageProvider field and were
 * always GridFS. */
export function getProviderForVersion(version) {
  return getProvider(version.storageProvider || gridfs.PROVIDER_ID);
}

export async function getAllProvidersUsage(db) {
  return Promise.all(
    Object.values(PROVIDERS).map(async (mod) => {
      try {
        return await mod.getUsage(db);
      } catch (error) {
        return { provider: mod.PROVIDER_ID, label: mod.PROVIDER_LABEL, error: error.message, configured: false };
      }
    })
  );
}
