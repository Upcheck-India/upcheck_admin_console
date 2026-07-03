'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  getSocket,
  isRealtimeConfigured,
  startRealtime,
  joinRoom,
  leaveRoom,
  subscribeConnection,
} from '../lib/realtime';
import { getRealtimeModes, subscribeRealtimeModes } from '../lib/realtimePrefs';

// Browser counterpart to the app's useRealtimeChat: shared per-room plumbing
// for a single conversation/team/group page. Joins the membership-checked
// room, dispatches message:new/updated for THIS room, and tracks the live
// typing list. Returns flags gated on actual connection so pages keep their
// polling path as the automatic fallback.
export function useRealtimeChat(kind, id, { onMessageNew, onMessageUpdated } = {}) {
  const [modes, setModes] = useState(() => getRealtimeModes());
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const handlersRef = useRef({ onMessageNew, onMessageUpdated });
  handlersRef.current = { onMessageNew, onMessageUpdated };
  const typingExpiry = useRef(new Map());

  useEffect(() => {
    const unsub = subscribeRealtimeModes(setModes);
    return unsub;
  }, []);

  const configured = isRealtimeConfigured();
  const wantMessaging = modes.messaging === 'realtime' && configured;
  const wantTyping = modes.typing === 'realtime' && configured;
  const active = (wantMessaging || wantTyping) && !!id;

  useEffect(() => {
    if (!active || !id) {
      setConnected(false);
      setTypingUsers([]);
      return;
    }
    startRealtime();

    const matches = (p) => p && p.kind === kind && String(p.id) === String(id);
    const onMsgNew = (p) => {
      if (matches(p) && p.message) handlersRef.current.onMessageNew?.(p.message);
    };
    const onMsgUpd = (p) => {
      if (matches(p) && p.message) handlersRef.current.onMessageUpdated?.(p.message);
    };
    const onTyping = (p) => {
      if (!matches(p) || !p.userId) return;
      const uid = String(p.userId);
      if (p.typing) {
        typingExpiry.current.set(uid, Date.now() + 5000);
        setTypingUsers((prev) =>
          prev.some((u) => u.userId === uid)
            ? prev
            : [...prev, { _id: uid, userId: uid, username: p.username || 'Someone', name: p.username || 'Someone' }]
        );
      } else {
        typingExpiry.current.delete(uid);
        setTypingUsers((prev) => prev.filter((u) => u.userId !== uid));
      }
    };

    const attach = () => {
      const s = getSocket();
      if (!s) return;
      s.off('message:new', onMsgNew).on('message:new', onMsgNew);
      s.off('message:updated', onMsgUpd).on('message:updated', onMsgUpd);
      s.off('typing:update', onTyping).on('typing:update', onTyping);
    };

    const unsubConn = subscribeConnection((isConn) => {
      setConnected(isConn);
      if (isConn) {
        attach();
        joinRoom(kind, id);
      } else {
        setTypingUsers([]);
        typingExpiry.current.clear();
      }
    });

    const prune = setInterval(() => {
      const now = Date.now();
      let changed = false;
      typingExpiry.current.forEach((exp, uid) => {
        if (exp <= now) {
          typingExpiry.current.delete(uid);
          changed = true;
        }
      });
      if (changed) setTypingUsers((prev) => prev.filter((u) => typingExpiry.current.has(u.userId)));
    }, 1500);

    return () => {
      clearInterval(prune);
      const s = getSocket();
      if (s) {
        s.off('message:new', onMsgNew);
        s.off('message:updated', onMsgUpd);
        s.off('typing:update', onTyping);
      }
      if (id) leaveRoom(kind, id);
      unsubConn();
      typingExpiry.current.clear();
    };
  }, [active, kind, id]);

  const emitTyping = useCallback(() => {
    if (wantTyping && connected) getSocket()?.emit('typing:start', { kind, id });
  }, [wantTyping, connected, kind, id]);

  return {
    messagingRealtime: wantMessaging && connected,
    typingRealtime: wantTyping && connected,
    connected,
    emitTyping,
    typingUsers,
  };
}
