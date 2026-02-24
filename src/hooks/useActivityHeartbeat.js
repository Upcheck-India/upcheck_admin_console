import { useEffect, useRef } from 'react';

/**
 * Activity Heartbeat Hook
 * Sends periodic heartbeats to track user activity in real-time
 * 
 * @param {string} documentId - The document being viewed
 * @param {string} roomId - The room containing the document
 * @param {string} action - The action being performed (viewing, editing, etc.)
 * @param {boolean} enabled - Whether heartbeat is enabled
 */
export function useActivityHeartbeat({ documentId, roomId, action = 'viewing', enabled = true }) {
  const intervalRef = useRef(null);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    if (!enabled || !documentId) return;

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval for periodic heartbeats (every 10 seconds)
    intervalRef.current = setInterval(() => {
      if (isVisibleRef.current) {
        sendHeartbeat();
      }
    }, 10000);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Send final heartbeat with 'stopped' action
      sendHeartbeat('stopped');
    };
  }, [documentId, roomId, action, enabled]);

  async function sendHeartbeat(overrideAction) {
    try {
      await fetch('/api/dataroom/activity/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          roomId,
          action: overrideAction || action,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }

  return { sendHeartbeat };
}
