// Shared shape + helpers for per-user realtime transport preferences.
// One document per user in the `user_preferences` collection:
//   { userId, realtime: { messaging, typing, presence, notifications }, updatedAt }
// Each module is 'realtime' | 'polling'. Default is 'realtime' for all — the
// polling path is the fallback/override, per the migration plan §3.4.

export const REALTIME_MODULES = ['messaging', 'typing', 'presence', 'notifications'];
const VALID_MODES = ['realtime', 'polling'];

export function defaultRealtimePrefs() {
  return {
    messaging: 'realtime',
    typing: 'realtime',
    presence: 'realtime',
    notifications: 'realtime',
  };
}

// Merge a stored (possibly partial/absent) prefs object over the defaults so
// callers always get all four modules with a valid mode.
export function normalizeRealtimePrefs(stored) {
  const out = defaultRealtimePrefs();
  if (stored && typeof stored === 'object') {
    for (const mod of REALTIME_MODULES) {
      if (VALID_MODES.includes(stored[mod])) {
        out[mod] = stored[mod];
      }
    }
  }
  return out;
}

// Sanitize an incoming partial update: keep only known modules with valid
// modes. Returns a $set-friendly object keyed as `realtime.<module>`.
export function buildRealtimeUpdate(body) {
  const set = {};
  if (body && typeof body === 'object') {
    for (const mod of REALTIME_MODULES) {
      if (mod in body) {
        if (!VALID_MODES.includes(body[mod])) {
          return { error: `Invalid mode for ${mod}: expected 'realtime' or 'polling'` };
        }
        set[`realtime.${mod}`] = body[mod];
      }
    }
  }
  return { set };
}
