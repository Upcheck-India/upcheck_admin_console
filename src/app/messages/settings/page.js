'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
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
    <div className="min-h-screen bg-slate-50 font-sans overflow-x-hidden pb-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-slate-200/80 px-6 py-5 shadow-sm sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/messages')}
              className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </button>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Direct Messaging Settings</h1>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Messaging ID Card */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
            <h2 className="text-md font-bold text-slate-800 tracking-tight mb-2">Workspace Discovery ID</h2>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Teammates need this unique ID to initiate direct messaging requests with you. Regenerating your ID resets your address book and securely deletes all message threads.
            </p>
            
            {user?.messagingId ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                <code className="flex-1 text-sm font-mono text-blue-600 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-inner select-all truncate">
                  {user.messagingId}
                </code>
                <div className="flex items-stretch gap-2">
                  <button
                    onClick={copyMessagingId}
                    className="flex-1 sm:flex-initial px-4 py-2 text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all duration-200 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                    title="Copy ID"
                  >
                    {copiedId ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-500" />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    onClick={rotateMessagingId}
                    disabled={rotating}
                    className="flex-1 sm:flex-initial px-4 py-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-600 hover:text-white rounded-xl transition-all duration-200 font-bold active:scale-95 disabled:opacity-50"
                  >
                    {rotating ? 'Regenerating...' : 'Regenerate'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50/70 border border-amber-200/60 rounded-2xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-amber-800 font-medium mb-3">
                      Messaging ID has not been initialized yet. Create your ID to start messaging teammates.
                    </p>
                    <button
                      onClick={initializeChat}
                      disabled={initializing}
                      className="px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2 text-xs font-bold transition-all active:scale-95 shadow-md shadow-amber-600/10"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${initializing ? 'animate-spin' : ''}`} />
                      {initializing ? 'Initializing...' : 'Create Discovery ID'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Connections Card */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50">
              <nav className="flex px-4">
                <button
                  onClick={() => setActiveTab('active')}
                  className={`px-5 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'active'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Active Connections
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-slate-200/60 text-slate-600'
                  }`}>
                    {activeConnections.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('blocked')}
                  className={`px-5 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'blocked'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Blocked Users
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'blocked' ? 'bg-blue-50 text-blue-600' : 'bg-slate-200/60 text-slate-600'
                  }`}>
                    {blockedConnections.length}
                  </span>
                </button>
              </nav>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border border-slate-100 rounded-2xl animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-slate-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/3 bg-slate-200 rounded" />
                        <div className="h-3 w-1/2 bg-slate-100 rounded" />
                      </div>
                      <div className="h-8 w-20 bg-slate-100 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {activeTab === 'active' && (
                    <div className="space-y-3">
                      {activeConnections.length === 0 ? (
                        <p className="text-center text-slate-400 py-10 text-xs font-medium">No active connections found</p>
                      ) : (
                        <>
                        {activeConnections.slice(0, visibleActive).map((conn) => (
                          <div
                            key={conn._id}
                            className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl bg-white hover:bg-slate-50/50 hover:border-slate-200 transition-all duration-200"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                {conn.peer?.username?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                  {conn.peer?.name || conn.peer?.username || 'Teammate'}
                                </p>
                                <p className="text-xs text-slate-400 truncate">{conn.peer?.email}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5 ml-4">
                              <button
                                onClick={() => handleBlock(conn.peerId, conn.peer?.name || conn.peer?.username)}
                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all duration-200 active:scale-90"
                                title="Block User"
                              >
                                <Shield className="w-4.5 h-4.5" />
                              </button>
                              <button
                                onClick={() => handleRevoke(conn.peerId, conn.peer?.name || conn.peer?.username)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-200 active:scale-90"
                                title="Remove Connection"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {activeConnections.length > visibleActive && (
                          <div className="text-center pt-2">
                            <button
                              onClick={() => setVisibleActive(c => c + 20)}
                              className="px-4 py-2 text-xs text-blue-600 hover:text-blue-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold transition-all"
                            >
                              Load More Connections
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
                        <p className="text-center text-slate-400 py-10 text-xs font-medium">No blocked users</p>
                      ) : (
                        <>
                        {blockedConnections.slice(0, visibleBlocked).map((conn) => (
                          <div
                            key={conn._id}
                            className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl bg-slate-50/50"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm">
                                {conn.peer?.username?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">
                                  {conn.peer?.name || conn.peer?.username || 'Teammate'}
                                </p>
                                <p className="text-xs text-slate-400 truncate">{conn.peer?.email}</p>
                                <p className="text-[9px] text-rose-500 font-bold uppercase tracking-wider mt-1">Blocked</p>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => handleUnblock(conn.peerId, conn.peer?.name || conn.peer?.username)}
                              className="px-4 py-2 text-xs text-blue-600 border border-blue-200 hover:border-blue-600 bg-white rounded-xl font-bold transition-all active:scale-95 shadow-sm"
                            >
                              Unblock
                            </button>
                          </div>
                        ))}
                        {blockedConnections.length > visibleBlocked && (
                          <div className="text-center pt-2">
                            <button
                              onClick={() => setVisibleBlocked(c => c + 20)}
                              className="px-4 py-2 text-xs text-blue-600 hover:text-blue-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold transition-all"
                            >
                              Load More Blocked
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
          <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-5 shadow-inner">
            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">Direct Messaging Guidelines</h3>
            <ul className="text-xs text-blue-800 space-y-2 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-blue-500">•</span>
                <span>Direct messaging is point-to-point and relies on teammate discovery using messaging IDs.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-blue-500">•</span>
                <span>You will only receive direct messages once you accept their connection request.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-blue-500">•</span>
                <span>Blocking a connection prevents the user from requesting or sending you direct messages.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagesSettings;
