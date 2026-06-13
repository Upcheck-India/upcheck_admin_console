'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import TopNav from '../../components/TopNav';

import {
  ArrowLeft, Trash2, Shield, Copy, CheckCircle, RefreshCw, AlertCircle
} from 'lucide-react';

const MessagesSettings = () => {
  const { user } = useAuth(false);
  const router = useRouter();
  const [connections, setConnections] = useState([]);
  const [visibleActive, setVisibleActive] = useState(20);
  const [visibleBlocked, setVisibleBlocked] = useState(20);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // active, blocked
  const [initializing, setInitializing] = useState(false);
  const [rotating, setRotating] = useState(false);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/chat/connections', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load connections');
      const data = await res.json();
      setConnections(data.connections || []);
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    setVisibleActive(20);
    setVisibleBlocked(20);
  }, [connections.length]);

  const initializeChat = async () => {
    if (!confirm('Create your Messaging ID now?')) return;
    try {
      setInitializing(true);
      const res = await fetch('/api/chat/init', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        alert('Messaging ID created successfully');
        window.location.reload();
      } else {
        alert(data.error || 'Failed to create Messaging ID');
      }
    } catch (e) {
      alert('Failed to create Messaging ID');
    } finally {
      setInitializing(false);
    }
  };

  const rotateMessagingId = async () => {
    if (!confirm('Regenerate your Messaging ID? This will DELETE all your chats, messages, and connections. This action cannot be undone.')) return;
    try {
      setRotating(true);
      const res = await fetch('/api/chat/rotate-id', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        alert('Messaging ID regenerated. All chats and connections were cleared.');
        window.location.reload();
      } else {
        alert(data.error || 'Failed to regenerate Messaging ID');
      }
    } catch (e) {
      alert('Failed to regenerate Messaging ID');
    } finally {
      setRotating(false);
    }
  };

  const handleRevoke = async (peerId, connectionName) => {
    if (!confirm(`Remove connection with ${connectionName}?`)) return;

    try {
      const res = await fetch('/api/chat/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ peerId, block: false })
      });

      if (res.ok) {
        fetchConnections();
      }
    } catch (e) {
      console.error('Revoke error:', e);
    }
  };

  const handleBlock = async (peerId, connectionName) => {
    if (!confirm(`Block ${connectionName}? They won't be able to message you.`)) return;

    try {
      const res = await fetch('/api/chat/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ peerId, block: true })
      });

      if (res.ok) {
        fetchConnections();
      }
    } catch (e) {
      console.error('Block error:', e);
    }
  };

  const handleUnblock = async (peerId, connectionName) => {
    if (!confirm(`Unblock ${connectionName}?`)) return;

    try {
      // Unblock by setting status back to accepted
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
      console.error('Unblock error:', e);
    }
  };

  const copyMessagingId = () => {
    if (user?.messagingId) {
      navigator.clipboard.writeText(user.messagingId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const activeConnections = connections.filter(c => c.status === 'accepted');
  const blockedConnections = connections.filter(c => c.status === 'blocked');

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/messages')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Messages Settings</h1>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Messaging ID Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Messaging ID</h2>
            <p className="text-sm text-gray-600 mb-3">
              Share this ID with others to allow them to start a conversation with you. If you regenerate your ID, all your chats and connections will be cleared.
            </p>
            
            {user?.messagingId ? (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <code className="flex-1 text-sm font-mono text-blue-700">
                  {user.messagingId}
                </code>
                <button
                  onClick={copyMessagingId}
                  className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                  title="Copy ID"
                >
                  {copiedId ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={rotateMessagingId}
                  disabled={rotating}
                  className="px-3 py-2 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                  title="Regenerate ID and wipe chats"
                >
                  {rotating ? 'Regenerating...' : 'Regenerate'}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-yellow-800 mb-3">
                      Messaging ID not set. Click below to create your Messaging ID to start using chat.
                    </p>
                    <button
                      onClick={initializeChat}
                      disabled={initializing}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${initializing ? 'animate-spin' : ''}`} />
                      {initializing ? 'Creating...' : 'Create Messaging ID'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('active')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'active'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Active Connections ({activeConnections.length})
                </button>
                <button
                  onClick={() => setActiveTab('blocked')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'blocked'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Blocked ({blockedConnections.length})
                </button>
              </nav>
            </div>

            <div className="p-6">
              {loading ? (
                <div>
                  <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4" />
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                        <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse" />
                        <div className="flex-1">
                          <div className="h-4 w-1/3 bg-gray-200 rounded mb-2 animate-pulse" />
                          <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
                        </div>
                        <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {activeTab === 'active' && (
                    <div className="space-y-3">
                      {activeConnections.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No active connections</p>
                      ) : (
                        <>
                        {activeConnections.slice(0, visibleActive).map((conn) => (
                          <div
                            key={conn._id}
                            className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">
                              {conn.peer?.username?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900">
                                {conn.peer?.name || conn.peer?.username || 'Unknown'}
                              </p>
                              <p className="text-sm text-gray-600 truncate">{conn.peer?.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleBlock(conn.peerId, conn.peer?.name || conn.peer?.username)}
                                className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                                title="Block"
                              >
                                <Shield className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleRevoke(conn.peerId, conn.peer?.name || conn.peer?.username)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Remove"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {activeConnections.length > visibleActive && (
                          <div className="text-center">
                            <button
                              onClick={() => setVisibleActive(c => c + 20)}
                              className="mt-2 px-4 py-2 text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                            >
                              Load more
                            </button>
                          </div>
                        )}
                        </>
                      )}
                    </div>
                  )}

                  {activeTab === 'blocked' && (
                    <div className="space-y-3">
                      {blockedConnections.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No blocked users</p>
                      ) : (
                        <>
                        {blockedConnections.slice(0, visibleBlocked).map((conn) => (
                          <div
                            key={conn._id}
                            className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50"
                          >
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold">
                              {conn.peer?.username?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900">
                                {conn.peer?.name || conn.peer?.username || 'Unknown'}
                              </p>
                              <p className="text-sm text-gray-600 truncate">{conn.peer?.email}</p>
                              <p className="text-xs text-red-600 mt-1">Blocked</p>
                            </div>
                            <button
                              onClick={() => handleUnblock(conn.peerId, conn.peer?.name || conn.peer?.username)}
                              className="px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                            >
                              Unblock
                            </button>
                          </div>
                        ))}
                        {blockedConnections.length > visibleBlocked && (
                          <div className="text-center">
                            <button
                              onClick={() => setVisibleBlocked(c => c + 20)}
                              className="mt-2 px-4 py-2 text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                            >
                              Load more
                            </button>
                          </div>
                        )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">About Messaging</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Only users with your Messaging ID can send you chat requests</li>
              <li>• You must accept a request before you can chat</li>
              <li>• Blocking prevents a user from messaging you</li>
              <li>• Messages are stored securely and updated every 5 seconds</li>
            </ul>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default MessagesSettings;
