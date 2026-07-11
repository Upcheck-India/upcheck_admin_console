// Feature-level settings for Status updates (separate from lib/media/settings.js,
// which only decides the storage BACKEND — this decides whether the feature
// exists at all, and how long an update lives before it's cleaned up).

export const STATUS_SETTINGS_COLLECTION = 'status_settings';
export const STATUS_SETTINGS_ID = 'singleton';

export const DEFAULT_RETENTION_HOURS = 24;
export const MIN_RETENTION_HOURS = 1;
export const MAX_RETENTION_HOURS = 168; // 1 week ceiling, sanity bound

const DEFAULT_SETTINGS = {
  _id: STATUS_SETTINGS_ID,
  statusEnabled: false,
  retentionHours: DEFAULT_RETENTION_HOURS,
  // Music-in-status is a separate, independently removable sub-feature (see
  // lib/music/) — gated on its own switch so it can be turned off (or the
  // whole thing deleted) without touching plain image statuses.
  musicEnabled: false,
};

export async function getStatusSettings(db) {
  const doc = await db.collection(STATUS_SETTINGS_COLLECTION).findOne({ _id: STATUS_SETTINGS_ID });
  if (!doc) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...doc };
}

export async function updateStatusSettings(db, patch) {
  const current = await getStatusSettings(db);
  const next = {
    statusEnabled: typeof patch.statusEnabled === 'boolean' ? patch.statusEnabled : current.statusEnabled,
    musicEnabled: typeof patch.musicEnabled === 'boolean' ? patch.musicEnabled : current.musicEnabled,
    retentionHours: current.retentionHours,
  };
  if (typeof patch.retentionHours === 'number' && Number.isFinite(patch.retentionHours)) {
    next.retentionHours = Math.min(MAX_RETENTION_HOURS, Math.max(MIN_RETENTION_HOURS, Math.round(patch.retentionHours)));
  }
  await db.collection(STATUS_SETTINGS_COLLECTION).updateOne(
    { _id: STATUS_SETTINGS_ID },
    { $set: { ...next, updatedAt: new Date() } },
    { upsert: true }
  );
  return { _id: STATUS_SETTINGS_ID, ...next };
}

export async function isStatusEnabled(db) {
  const settings = await getStatusSettings(db);
  return !!settings.statusEnabled;
}

export async function isMusicStatusEnabled(db) {
  const settings = await getStatusSettings(db);
  return !!settings.statusEnabled && !!settings.musicEnabled;
}
