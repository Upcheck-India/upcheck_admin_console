'use client';

import { io } from 'socket.io-client';

// Single shared Socket.IO connection for the web console, mirroring the app's
// lib/realtime.ts. Delivery-only: messages are still sent via the existing
// HTTP routes. If the socket can't connect, consumers fall back to polling.

const REALTIME_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_REALTIME_URL) || '';

let socket = null;
let started = false;
let connected = false;
let tokenRefreshTimer = null;

const onlineIds = new Set();
const presenceListeners = new Set();
const connListeners = new Set();

function notifyPresence() {
  const snap = new Set(onlineIds);
  presenceListeners.forEach((cb) => {
    try { cb(snap); } catch { /* ignore */ }
  });
}
function notifyConn() {
  connListeners.forEach((cb) => {
    try { cb(connected); } catch { /* ignore */ }
  });
}

async function fetchToken() {
  try {
    const res = await fetch('/api/realtime/token', { method: 'POST', cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.token || null;
  } catch {
    return null;
  }
}

function wire(s) {
  s.on('connect', () => { connected = true; notifyConn(); });
  s.on('disconnect', () => { connected = false; notifyConn(); });
  s.io.on('reconnect_attempt', async () => {
    const token = await fetchToken();
    if (token) s.auth = { token };
  });
  s.on('presence:snapshot', (p) => {
    onlineIds.clear();
    (p?.userIds || []).forEach((id) => onlineIds.add(String(id)));
    notifyPresence();
  });
  s.on('presence:online', (p) => {
    if (p?.userId) { onlineIds.add(String(p.userId)); notifyPresence(); }
  });
  s.on('presence:offline', (p) => {
    if (p?.userId) { onlineIds.delete(String(p.userId)); notifyPresence(); }
  });
}

export function isRealtimeConfigured() {
  return !!REALTIME_URL;
}

export async function startRealtime() {
  if (started || !REALTIME_URL || typeof window === 'undefined') return;
  started = true;
  const token = await fetchToken();
  if (!token) { started = false; return; }
  socket = io(REALTIME_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 8000,
    withCredentials: true,
  });
  wire(socket);
  tokenRefreshTimer = setInterval(async () => {
    if (!socket) return;
    const t = await fetchToken();
    if (t) socket.auth = { token: t };
  }, 8 * 60 * 1000);
}

export function stopRealtime() {
  started = false;
  connected = false;
  if (tokenRefreshTimer) { clearInterval(tokenRefreshTimer); tokenRefreshTimer = null; }
  if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null; }
  onlineIds.clear();
  notifyPresence();
  notifyConn();
}

export function isRealtimeConnected() {
  return connected;
}

export function subscribePresence(cb) {
  presenceListeners.add(cb);
  cb(new Set(onlineIds));
  return () => presenceListeners.delete(cb);
}

export function subscribeConnection(cb) {
  connListeners.add(cb);
  cb(connected);
  return () => connListeners.delete(cb);
}

export function getSocket() {
  return socket;
}

export function joinRoom(kind, id) {
  if (socket && id) socket.emit('join', { kind, id });
}

export function leaveRoom(kind, id) {
  if (socket && id) socket.emit('leave', { kind, id });
}
