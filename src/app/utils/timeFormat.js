// Shared 12h/24h message-timestamp preference for the web console, mirroring
// the mobile app's lib/timeFormat.ts + PreferencesContext. Persisted in
// localStorage (global, not per-conversation) since it's a personal display
// preference, not a chat-specific setting.
'use client';

import { useState, useEffect } from 'react';

const TIME_FORMAT_KEY = 'pref_time_format';
const TIME_FORMAT_EVENT = 'time-format-changed';

export function getTimeFormatPreference() {
  if (typeof window === 'undefined') return '12h';
  const saved = localStorage.getItem(TIME_FORMAT_KEY);
  return saved === '24h' ? '24h' : '12h';
}

export function setTimeFormatPreference(format) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TIME_FORMAT_KEY, format);
  window.dispatchEvent(new Event(TIME_FORMAT_EVENT));
}

export function formatMessageTime(date, format) {
  const d = date instanceof Date ? date : new Date(date);
  if (format === '24h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// React hook: returns the current preference and stays in sync across
// components/tabs via the custom event dispatched by setTimeFormatPreference
// and the native `storage` event (fired when changed from another tab).
export function useTimeFormat() {
  const [format, setFormat] = useState(getTimeFormatPreference);

  useEffect(() => {
    const onChange = () => setFormat(getTimeFormatPreference());
    window.addEventListener(TIME_FORMAT_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(TIME_FORMAT_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  return format;
}
