'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import {
  MessageCircle, Search, Settings, Plus, X, Check,
  AlertCircle, UserPlus, Copy, CheckCircle
} from 'lucide-react';

const POLL_INTERVAL = 5000; // 5 seconds

const MessagesHome = () => {
  const { user, isLoading: authLoading } = useAuth(false);
  const router = useRouter();
  const [connections, setConnections] = useState([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatId, setNewChatId] = useState('');
  const [findingUser, setFindingUser] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [error, setError] = useState('');
  const [lastPoll, setLastPoll] = useState(new Date().toISOString());
  const [copiedId, setCopiedId] = useState(false);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/connections', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load connections');
      const data = await res.json();
      setConnections(data.connections || []);
    } catch (e) {
      console.error('Fetch connections error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateMessagingId = async () => {
    try {
      const res = await fetch('/api/chat/init', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        await fetchConnections();
        window.location.reload();
      } else {
        alert(data.error || 'Failed to generate Messaging ID');
      }
    } catch (e) {
      alert('Failed to generate Messaging ID');
    }
  };

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/poll?since=${encodeURIComponent(lastPoll)}`, {
        credentials: 'include'
      });
      if (!res.ok) return;
      const data = await res.json();

      // Refresh connections if we have updates
      if (data.newMessages?.length > 0 || data.pendingRequests?.length > 0 || data.connectionUpdates?.length > 0) {
        fetchConnections();
      }
      
      setLastPoll(new Date().toISOString());
    } catch (e) {
      console.error('Poll error:', e);
    }
  }, [lastPoll, fetchConnections]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    // reset visible count on new fetch
    setVisibleCount(20);
  }, [connections.length]);

  useEffect(() => {
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [poll]);

  const handleFindUser = async () => {
    if (!newChatId.trim()) return;
    
    setFindingUser(true);
    setError('');
    setFoundUser(null);

    try {
      const res = await fetch('/api/chat/find-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messagingId: newChatId.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'User not found');
        return;
      }

      setFoundUser(data);
    } catch (e) {
      setError('Failed to find user');
    } finally {
      setFindingUser(false);
    }
  };

  const handleStartChat = async () => {
    if (!foundUser?.user?.id) return;

    try {
      const res = await fetch('/api/chat/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ peerId: foundUser.user.id })
      });

      const data = await res.json();

      if (res.ok && data.conversationId) {
        setShowNewChat(false);
        setNewChatId('');
        setFoundUser(null);
        await fetchConnections();
        router.push(`/messages/${data.conversationId}`);
      }
    } catch (e) {
      setError('Failed to start chat');
    }
  };

  const handleAccept = async (peerId) => {
    try {
      const res = await fetch('/api/chat/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ peerId })
      });

      if (res.ok) {
        fetchConnections();
      }
    } catch (e) {
      console.error('Accept error:', e);
    }
  };

  const handleRevoke = async (peerId, block = false) => {
    if (!confirm(block ? 'Block this user?' : 'Remove this connection?')) return;

    try {
      const res = await fetch('/api/chat/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ peerId, block })
      });

      if (res.ok) {
        fetchConnections();
      }
    } catch (e) {
      console.error('Revoke error:', e);
    }
  };

  const copyMessagingId = () => {
    if (user?.messagingId) {
      navigator.clipboard.writeText(user.messagingId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return d.toLocaleDateString();
  };

  const filteredConnections = connections.filter(c => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      c.peer?.username?.toLowerCase().includes(search) ||
      c.peer?.name?.toLowerCase().includes(search) ||
      c.peer?.email?.toLowerCase().includes(search)
    );
  });

  const acceptedChats = filteredConnections.filter(c => c.status === 'accepted');
  const pendingRequests = filteredConnections.filter(c => c.status === 'pending');

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Left Sidebar - Conversations List */}
      <div className="w-full md:w-96 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewChat(true)}
                disabled={!user?.messagingId}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                title={user?.messagingId ? 'New chat' : 'Generate Messaging ID to start'}
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={() => router.push('/messages/settings')}
                className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* User's messaging ID */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Your Messaging ID</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-blue-700 truncate">
                {user?.messagingId || 'Not set'}
              </code>
              {user?.messagingId ? (
                <button
                  onClick={copyMessagingId}
                  className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                  title="Copy ID"
                >
                  {copiedId ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              ) : (
                <button
                  onClick={generateMessagingId}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Generate
                </button>
              )}
            </div>
          </div>

          {!user?.messagingId && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-800">
                <p className="font-medium">Messaging ID not set</p>
                <p>Generate your Messaging ID to start or receive chat requests. This keeps discovery private.</p>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="p-4 bg-yellow-50 border-b border-yellow-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Pending Requests</h3>
            {pendingRequests.map((req) => (
              <div key={req._id} className="flex items-center gap-3 p-2 bg-white rounded-lg mb-2 last:mb-0">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-semibold flex-shrink-0">
                  {req.peer?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {req.peer?.name || req.peer?.username}
                  </p>
                  <p className="text-xs text-gray-500">wants to chat</p>
                </div>
                {req.initiatedBy === (user?.id || user?._id) ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Request sent</span>
                    <button
                      onClick={() => handleRevoke(req.peerId)}
                      className="px-2 py-1 text-xs text-red-600 border border-red-600 rounded hover:bg-red-50"
                      title="Cancel request"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAccept(req.peerId)}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                      title="Accept"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRevoke(req.peerId)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Decline"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {acceptedChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
              <MessageCircle className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium">No conversations yet</p>
              <p className="text-sm text-center mt-2">
                Click the <Plus className="w-4 h-4 inline" /> button to start a new chat
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {acceptedChats.slice(0, visibleCount).map((chat) => (
                <li
                  key={chat._id}
                  onClick={() => router.push(`/messages/${chat.conversationId}`)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold flex-shrink-0">
                      {chat.peer?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {chat.peer?.name || chat.peer?.username || 'Unknown'}
                        </p>
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                          {formatTime(chat.lastMessage?.createdAt || chat.updatedAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 truncate">
                          {chat.lastMessage?.body || 'No messages yet'}
                        </p>
                        {chat.unreadCount > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full flex-shrink-0">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              {acceptedChats.length > visibleCount && (
                <li className="p-4 text-center">
                  <button
                    onClick={() => setVisibleCount(c => c + 20)}
                    className="px-4 py-2 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors"
                  >
                    Load more
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Start New Chat</h2>
              <button
                onClick={() => {
                  setShowNewChat(false);
                  setNewChatId('');
                  setFoundUser(null);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter User's Messaging ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChatId}
                    onChange={(e) => setNewChatId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleFindUser()}
                    placeholder="e.g., a1b2c3d4e5f6..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleFindUser}
                    disabled={findingUser || !newChatId.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {findingUser ? 'Finding...' : 'Find'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}

              {foundUser && (
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold flex-shrink-0">
                      {foundUser.user.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {foundUser.user.name || foundUser.user.username}
                      </p>
                      <p className="text-sm text-gray-600 truncate">{foundUser.user.email}</p>
                    </div>
                  </div>

                  {foundUser.connection ? (
                    <div className="space-y-2">
                      {foundUser.connection.status === 'accepted' && (
                        <>
                          <p className="text-green-600 text-sm">✓ Already connected</p>
                          {foundUser.connection.conversationId && (
                            <button
                              onClick={() => {
                                setShowNewChat(false);
                                setNewChatId('');
                                setFoundUser(null);
                                setError('');
                                router.push(`/messages/${foundUser.connection.conversationId}`);
                              }}
                              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                              Open Chat
                            </button>
                          )}
                        </>
                      )}
                      {foundUser.connection.status === 'pending' && (
                        <p className="text-yellow-600 text-sm">⏳ Request pending</p>
                      )}
                      {foundUser.connection.status === 'revoked' && (
                        <button
                          onClick={handleStartChat}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
                        >
                          <UserPlus className="w-4 h-4" />
                          Re-send Chat Request
                        </button>
                      )}
                      {foundUser.connection.status === 'blocked' && (
                        <p className="text-red-600 text-sm">🚫 You cannot send a request to this user.</p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={handleStartChat}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      Send Chat Request
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state for desktop */}
      <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <MessageCircle className="w-24 h-24 mx-auto mb-4 text-gray-300" />
          <p className="text-xl font-medium">Select a conversation</p>
          <p className="text-sm mt-2">Choose a chat from the list to start messaging</p>
        </div>
      </div>
    </div>
  );
};

export default MessagesHome;