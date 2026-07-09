// Shared shape/validation for the "What's New" changelog feature — admin-
// triggered app update notes surfaced to users as a banner, popup, forced
// popup, or full-page changelog. 'silent' opts an entry out of auto-surfacing
// entirely — it only ever shows up in the What's New history list, never as
// an unprompted banner/popup (see GET /api/changelogs/unseen, which filters
// these out before picking "the latest unseen" for a client to display).
export const DISPLAY_MODES = ['banner', 'popup', 'forced', 'full_page', 'silent'];

export function isValidDisplayMode(mode) {
  return DISPLAY_MODES.includes(mode);
}

export function isAdminRole(role) {
  return role === 'Admin' || role === 'Console admin';
}
