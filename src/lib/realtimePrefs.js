'use client';

// Browser-side cache of the user's realtime transport preferences for the web
// console (which has no global preferences provider like the app does). The
// server is the source of truth (GET/PUT /api/settings/realtime-preferences);
// this keeps a localStorage mirror so consumers can read synchronously and
// react to changes via a custom window event.

const LS_KEY = 'realtime_modes';
const EVENT = 'realtime-prefs-changed';

export const REALTIME_MODULES = ['messaging', 'typing', 'presence', 'notifications'];
const VALID = ['realtime', 'polling'];

export function defaultRealtimeModes() {
  return { messaging: 'realtime', typing: 'realtime', presence: 'realtime', notifications: 'realtime' };
}

function normalize(raw) {
  const out = defaultRealtimeModes();
  if (raw && typeof raw === 'object') {
    for (const m of REALTIME_MODULES) {
      if (VALID.includes(raw[m])) out[m] = raw[m];
    }
  }
  return out;
}

// Synchronous read from the localStorage mirror (defaults if absent/SSR).
export function getRealtimeModes() {
  if (typeof window === 'undefined') return defaultRealtimeModes();
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? normalize(JSON.parse(raw)) : defaultRealtimeModes();
  } catch {
    return defaultRealtimeModes();
  }
}

function store(modes) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(modes));
  } catch {
    /* ignore quota/availability errors */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: modes }));
}

// Fetch authoritative prefs from the server and refresh the local mirror.
export async function refreshRealtimeModes() {
  try {
    const res = await fetch('/api/settings/realtime-preferences', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const modes = normalize(data?.realtime);
      store(modes);
      return modes;
    }
  } catch {
    /* offline / not authed — keep local mirror */
  }
  return getRealtimeModes();
}

// Persist a single module's mode: PUT server, then update the local mirror.
export async function setRealtimeMode(module, mode) {
  const next = { ...getRealtimeModes(), [module]: mode };
  store(next); // optimistic
  try {
    await fetch('/api/settings/realtime-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [module]: mode }),
    });
  } catch {
    /* best-effort; local mirror already updated */
  }
  return next;
}

// Subscribe to preference changes (same-tab custom event + cross-tab storage).
export function subscribeRealtimeModes(cb) {
  if (typeof window === 'undefined') return () => {};
  const onEvent = (e) => cb(e.detail || getRealtimeModes());
  const onStorage = (e) => {
    if (e.key === LS_KEY) cb(getRealtimeModes());
  };
  window.addEventListener(EVENT, onEvent);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, onEvent);
    window.removeEventListener('storage', onStorage);
  };
}
