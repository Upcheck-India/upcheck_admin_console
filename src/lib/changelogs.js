// Shared shape/validation for the "What's New" changelog feature — admin-
// triggered app update notes surfaced to users as a banner, popup, forced
// popup, or full-page changelog.

export const DISPLAY_MODES = ['banner', 'popup', 'forced', 'full_page'];

export function isValidDisplayMode(mode) {
  return DISPLAY_MODES.includes(mode);
}

export function isAdminRole(role) {
  return role === 'Admin' || role === 'Console admin';
}
