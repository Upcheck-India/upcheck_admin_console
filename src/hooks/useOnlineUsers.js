// src/hooks/useOnlineUsers.js
'use client';

import { useState, useEffect } from 'react';
import {
  isRealtimeConfigured,
  startRealtime,
  subscribePresence,
  subscribeConnection,
} from '../lib/realtime';
import {
  getRealtimeModes,
  refreshRealtimeModes,
  subscribeRealtimeModes,
} from '../lib/realtimePrefs';

// Returns the set of currently-online users.
//
// - presence mode 'realtime' + socket connected: driven by socket presence
//   events (near-instant, no fixed polling). /api/online-users is still used
//   to resolve profiles, but only when the online set changes.
// - otherwise: the original fixed-interval poll of /api/online-users.
export default function useOnlineUsers(refreshMs = 15000) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [presenceMode, setPresenceMode] = useState(() => getRealtimeModes().presence);

  // Keep presence mode in sync with the stored preference (settings page).
  useEffect(() => {
    refreshRealtimeModes().then((m) => setPresenceMode(m.presence)).catch(() => {});
    const unsub = subscribeRealtimeModes((m) => setPresenceMode(m.presence));
    return unsub;
  }, []);

  const useRealtime = presenceMode === 'realtime' && isRealtimeConfigured();

  useEffect(() => {
    let active = true;
    const profileCache = new Map();

    const fetchOnline = async () => {
      try {
        const res = await fetch('/api/online-users', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            data.forEach((u) => { if (u && u._id) profileCache.set(String(u._id), u); });
            return data;
          }
        }
      } catch (err) {
        console.error('Failed to fetch online users', err);
      }
      return null;
    };

    // ---------- Polling mode ----------
    if (!useRealtime) {
      const run = async () => {
        const data = await fetchOnline();
        if (active && data) setOnlineUsers(data);
      };
      run();
      const id = setInterval(run, refreshMs);
      return () => { active = false; clearInterval(id); };
    }

    // ---------- Realtime presence mode ----------
    startRealtime();
    let fillTimer = null;
    let fallbackInterval = null;

    const renderFromIds = (ids) => {
      const list = [];
      ids.forEach((id) => list.push(profileCache.get(id) || { _id: id, username: '' }));
      if (active) setOnlineUsers(list);
    };

    fetchOnline().then((data) => { if (data && active) setOnlineUsers(data); });

    const unsubPresence = subscribePresence((ids) => {
      renderFromIds(ids);
      const hasUnknown = Array.from(ids).some((id) => !profileCache.has(id));
      if (hasUnknown) {
        if (fillTimer) clearTimeout(fillTimer);
        fillTimer = setTimeout(async () => {
          await fetchOnline();
          renderFromIds(ids);
        }, 500);
      }
    });

    const unsubConn = subscribeConnection((isConnected) => {
      if (isConnected) {
        if (fallbackInterval) { clearInterval(fallbackInterval); fallbackInterval = null; }
      } else if (!fallbackInterval) {
        fallbackInterval = setInterval(async () => {
          const data = await fetchOnline();
          if (active && data) setOnlineUsers(data);
        }, refreshMs);
      }
    });

    return () => {
      active = false;
      if (fillTimer) clearTimeout(fillTimer);
      if (fallbackInterval) clearInterval(fallbackInterval);
      unsubPresence();
      unsubConn();
    };
  }, [useRealtime, refreshMs]);

  return onlineUsers;
}
