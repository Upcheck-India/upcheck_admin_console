// Single-document collection holding the admin-configurable media storage
// settings, following the same precedent as `appstore_settings` (see
// src/lib/storage/index.js) — a master on/off switch plus a per-feature
// provider choice, so a specific media type (avatars, chat media, ...) can
// be moved to Cloudinary independently, and everything falls back to the
// existing GridFS behavior if Cloudinary is off or misconfigured.

export const MEDIA_SETTINGS_COLLECTION = 'media_settings';
export const MEDIA_SETTINGS_ID = 'singleton';

export const MEDIA_FEATURES = ['avatar', 'chatMedia'];
export const MEDIA_PROVIDERS = ['gridfs', 'cloudinary'];

const DEFAULT_SETTINGS = {
  _id: MEDIA_SETTINGS_ID,
  cloudinaryEnabled: false,
  providers: {
    avatar: 'gridfs',
    chatMedia: 'gridfs',
  },
};

export async function getMediaSettings(db) {
  const doc = await db.collection(MEDIA_SETTINGS_COLLECTION).findOne({ _id: MEDIA_SETTINGS_ID });
  if (!doc) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...doc,
    providers: { ...DEFAULT_SETTINGS.providers, ...(doc.providers || {}) },
  };
}

export async function updateMediaSettings(db, patch) {
  const current = await getMediaSettings(db);
  const next = {
    cloudinaryEnabled: typeof patch.cloudinaryEnabled === 'boolean' ? patch.cloudinaryEnabled : current.cloudinaryEnabled,
    providers: { ...current.providers, ...(patch.providers || {}) },
  };
  await db.collection(MEDIA_SETTINGS_COLLECTION).updateOne(
    { _id: MEDIA_SETTINGS_ID },
    { $set: { ...next, updatedAt: new Date() } },
    { upsert: true }
  );
  return { _id: MEDIA_SETTINGS_ID, ...next };
}

// The only thing upload routes actually need: "is Cloudinary the active
// provider for this feature right now?" The master switch always wins —
// flipping it off instantly reverts every feature to GridFS regardless of
// its individual provider setting, without having to edit each one back.
export async function isCloudinaryActive(db, feature) {
  const settings = await getMediaSettings(db);
  if (!settings.cloudinaryEnabled) return false;
  return settings.providers?.[feature] === 'cloudinary';
}
