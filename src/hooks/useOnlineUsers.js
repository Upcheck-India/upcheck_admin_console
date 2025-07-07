// src/hooks/useOnlineUsers.js
import { useState, useEffect } from 'react';

export default function useOnlineUsers(refreshMs = 15000) {
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const fetchOnline = async () => {
      try {
        const res = await fetch('/api/online-users', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setOnlineUsers(data);
        }
      } catch (err) {
        console.error('Failed to fetch online users', err);
      }
    };

    fetchOnline();
    const id = setInterval(fetchOnline, refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  return onlineUsers;
}
