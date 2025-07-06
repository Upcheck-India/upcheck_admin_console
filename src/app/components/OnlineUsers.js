'use client';

import React, { useState, useEffect } from 'react';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import Image from 'next/image';

const OnlineUsers = () => {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOnlineUsers = async () => {
      try {
        const response = await fetch('/api/users/online');
        if (!response.ok) {
          throw new Error('Failed to fetch online users');
        }
        const data = await response.json();
        setOnlineUsers(data.users);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching online users:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    // Update current user's status
    const updateStatus = async () => {
      const userId = localStorage.getItem('userId');
      if (userId) {
        try {
          await fetch('/api/users/status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId })
          });
        } catch (error) {
          console.error('Error updating status:', error);
        }
      }
    };

    // Initial fetch and status update
    fetchOnlineUsers();
    updateStatus();

    // Set up polling for real-time updates
    const pollOnlineStatus = async () => {
      try {
        await fetchOnlineUsers();
      } catch (err) {
        console.error('Polling error:', err);
      }
      setTimeout(pollOnlineStatus, 15000); // Poll every 15 seconds for more frequent updates
    };

    // Set up heartbeat to maintain online status
    const heartbeat = setInterval(updateStatus, 10000); // Send heartbeat every 10 seconds

    pollOnlineStatus();

    // Cleanup
    return () => {
      clearInterval(heartbeat);
    };
  }, []);

  const visibleUsers = showAllUsers ? onlineUsers : onlineUsers.slice(0, 3);
  const moreUsers = onlineUsers.length - 3;

  return (
    <div className="relative inline-block">
      <button
        className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
        onClick={() => setShowAllUsers(!showAllUsers)}
      >
        <Users className="w-4 h-4" />
        <span className="text-sm">{visibleUsers.length} Online</span>
        {moreUsers > 0 && (
          <span className="text-xs text-blue-600">+{moreUsers}</span>
        )}
        {showAllUsers ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {showAllUsers && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50">
          <div className="space-y-2">
            {onlineUsers.map((user) => (
              <div key={user._id} className="flex items-center space-x-2">
                <div className="relative w-8 h-8">
                  <Image
                    src={user.avatar || '/default-avatar.png'}
                    alt={`${user.username} avatar`}
                    fill
                    className="rounded-full object-cover"
                  />
                  <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{user.username}</div>
                  <div className="text-xs text-gray-500">{user.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineUsers;
