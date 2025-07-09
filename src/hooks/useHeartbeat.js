// src/hooks/useHeartbeat.js
// Sends a heartbeat every 10 seconds for authenticated users
import { useEffect, useRef } from 'react';

export default function useHeartbeat(enabled = true, intervalMs = 15000) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/heartbeat', {
          method: 'GET',
          credentials: 'include',
        });
      } catch (err) {
        console.error('Heartbeat failed', err);
      }
    };

    // Send immediately on mount then start interval
    sendHeartbeat();
    timerRef.current = setInterval(sendHeartbeat, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, intervalMs]);
}
