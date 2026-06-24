'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import {
  MessageCircle, Search, Settings, Plus, X, Check,
  AlertCircle, UserPlus, Copy, CheckCircle, Hash, Users, Loader
} from 'lucide-react';

const POLL_INTERVAL = 5000; // 5 seconds

const MessagesHome = () => {
  const { user, isLoading: authLoading } = useAuth(false);
  const router = useRouter();
  const [connections, setConnections] = useState([]);
  const [teams, setTeams] = useState([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatId, setNewChatId] = useState('');
  const [findingUser, setFindingUser] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [error, setError] = useState('');

  const [modalTab, setModalTab] = useState('search');
  const [discoverableUsers, setDiscoverableUsers] = useState([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);

  const fetchDiscoverableUsers = async () => {
    setLoadingDiscover(true);
    try {
      const res = await fetch('/api/chat/discover');
      if (res.ok) {
        const data = await res.json();
        setDiscoverableUsers(data.users || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDiscover(false);
    }
  };
  const [lastPoll, setLastPoll] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/connections', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load connections');
      const data = await res.json();
      setConnections(data.connections || []);

      const teamRes = await fetch('/api/teams', { credentials: 'include' });
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeams(teamData.teams || []);
      }
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
      
      if (data.serverTimestamp) {
        setLastPoll(data.serverTimestamp);
      }
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
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Left Sidebar - Conversations List */}
      <div className="w-full md:w-96 border-r border-slate-200/80 bg-white flex flex-col shadow-sm z-10">
        {/* Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Direct Messaging</h1>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowNewChat(true)}
                disabled={!user?.messagingId}
                className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
                title={user?.messagingId ? 'New Chat' : 'Generate Messaging ID to start'}
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </button>
              <button
                onClick={() => router.push('/messages/settings')}
                className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* User's messaging ID - Premium Slate/Cyan Card */}
          <div className="mb-4 p-4 bg-gradient-to-tr from-slate-900 to-slate-800 text-white rounded-2xl shadow-md border border-slate-700/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none"></div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Your Messaging ID</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-cyan-300 bg-slate-950/50 px-2.5 py-1.5 rounded-lg border border-slate-800/80 truncate select-all">
                {user?.messagingId || 'Not generated yet'}
              </code>
              {user?.messagingId ? (
                <button
                  onClick={copyMessagingId}
                  className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all duration-200 active:scale-90"
                  title="Copy ID"
                >
                  {copiedId ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              ) : (
                <button
                  onClick={generateMessagingId}
                  className="px-3.5 py-1.5 text-xs bg-cyan-400 text-slate-950 font-bold rounded-lg hover:bg-cyan-300 transition-all duration-200 shadow-sm"
                >
                  Generate
                </button>
              )}
            </div>
          </div>

          {!user?.messagingId && (
            <div className="mb-4 p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800 leading-relaxed">
                <p className="font-semibold">Discovery details are hidden</p>
                <p className="opacity-90">Generate your Messaging ID to send or receive secure chat requests.</p>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/80 focus:bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm placeholder-slate-400 text-slate-800"
            />
          </div>
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="p-4 bg-amber-50/40 border-b border-amber-100 flex-shrink-0 max-h-48 overflow-y-auto">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2.5">Pending Requests</h3>
            {pendingRequests.map((req) => (
              <div key={req._id} className="flex items-center gap-3 p-2.5 bg-white rounded-xl mb-2 last:mb-0 shadow-sm border border-amber-200/30">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white font-bold flex-shrink-0 text-sm shadow-sm">
                  {req.peer?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {req.peer?.name || req.peer?.username}
                  </p>
                  <p className="text-[10px] text-slate-500">Wants to connect</p>
                </div>
                {req.initiatedBy === (user?.id || user?._id) ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-medium">Sent</span>
                    <button
                      onClick={() => handleRevoke(req.peerId)}
                      className="px-2.5 py-1 text-[10px] text-rose-600 hover:text-white border border-rose-200 hover:border-rose-500 hover:bg-rose-500 rounded-lg transition-all duration-200 font-semibold"
                      title="Cancel Request"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAccept(req.peerId)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-200"
                      title="Accept"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </button>
                    <button
                      onClick={() => handleRevoke(req.peerId)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all duration-200"
                      title="Decline"
                    >
                      <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100/50">
          <div>
            <div className="px-4.5 pt-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Direct Messages</span>
              <span className="text-[9px] text-blue-500 font-semibold bg-blue-50 px-1.5 py-0.5 rounded-md">DMs</span>
            </div>
            {acceptedChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-slate-400 text-center">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 mb-2 border border-slate-100 shadow-inner">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-600">No chats yet</p>
                <p className="text-[10px] mt-0.5 text-slate-400 max-w-[180px] leading-relaxed">
                  Click the plus icon above to find a teammate.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {acceptedChats.slice(0, visibleCount).map((chat) => (
                  <li
                    key={chat._id}
                    onClick={() => router.push(`/messages/${chat.conversationId}`)}
                    className="p-3 hover:bg-slate-50/80 cursor-pointer transition-all duration-200 group border-l-2 border-transparent hover:border-blue-500 hover:translate-x-0.5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md text-xs">
                          {chat.peer?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                            {chat.peer?.name || chat.peer?.username || 'Teammate'}
                          </p>
                          <span className="text-[9px] text-slate-400 ml-2 font-medium flex-shrink-0">
                            {formatTime(chat.lastMessage?.createdAt || chat.updatedAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-slate-500 truncate pr-2">
                            {chat.lastMessage?.body || 'No messages yet'}
                          </p>
                          {chat.unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded-full flex-shrink-0 shadow-sm animate-pulse">
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
                {acceptedChats.length > visibleCount && (
                  <li className="p-3 text-center">
                    <button
                      onClick={() => setVisibleCount(c => c + 20)}
                      className="px-3 py-1.5 text-[10px] text-blue-600 border border-slate-200 hover:border-blue-600 rounded-lg hover:bg-blue-50 transition-all duration-200 font-semibold shadow-sm"
                    >
                      Load More
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Channels & Teams */}
          <div className="pt-2">
            <div className="px-4.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Channels & Teams</span>
            </div>
            <div className="space-y-0.5 pb-4">
              {teams.length === 0 ? (
                 <div className="px-4.5 py-2 text-[10px] text-slate-400">No teams joined yet</div>
              ) : (
                teams.map((team) => (
                  <div
                    key={team._id}
                    onClick={() => router.push(`/messages/team/${team._id}`)}
                    className="flex items-center gap-2.5 px-4.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer border-l-2 border-transparent hover:border-blue-500 group transition-all"
                  >
                    <Hash className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 flex-shrink-0" />
                    <span className="truncate flex-1 group-hover:text-blue-600">{team.name}</span>
                    {team.unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded-full flex-shrink-0 shadow-sm animate-pulse">
                        {team.unreadCount}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden transform scale-100 transition-all duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-md font-bold text-slate-900">Start a Teammate Chat</h2>
              <button
                onClick={() => {
                  setShowNewChat(false);
                  setNewChatId('');
                  setFoundUser(null);
                  setError('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex bg-slate-100 rounded-lg p-1 mb-4">
                <button
                  onClick={() => setModalTab('search')}
                  className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all ${
                    modalTab === 'search' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Find by ID
                </button>
                <button
                  onClick={() => {
                    setModalTab('discover');
                    fetchDiscoverableUsers();
                  }}
                  className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all ${
                    modalTab === 'discover' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Discover Teammates
                </button>
              </div>

              {modalTab === 'search' ? (
                <>
                  <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Enter Messaging ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChatId}
                    onChange={(e) => setNewChatId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleFindUser()}
                    placeholder="e.g., a1b2c3d4..."
                    className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400 bg-slate-50"
                  />
                  <button
                    onClick={handleFindUser}
                    disabled={findingUser || !newChatId.trim()}
                    className="px-4.5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md shadow-blue-500/10 active:scale-95"
                  >
                    {findingUser ? 'Finding...' : 'Find'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span className="text-xs text-rose-700 font-medium">{error}</span>
                </div>
              )}

              {foundUser && (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl shadow-inner">
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0 text-md shadow-md">
                      {foundUser.user.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {foundUser.user.name || foundUser.user.username}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{foundUser.user.email}</p>
                    </div>
                  </div>

                  {foundUser.connection ? (
                    <div className="space-y-2">
                      {foundUser.connection.status === 'accepted' && (
                        <>
                          <p className="text-emerald-600 text-xs font-semibold flex items-center gap-1 mb-2">
                            <Check className="w-4 h-4 stroke-[2.5]" /> Already connected
                          </p>
                          {foundUser.connection.conversationId && (
                            <button
                              onClick={() => {
                                setShowNewChat(false);
                                setNewChatId('');
                                setFoundUser(null);
                                setError('');
                                router.push(`/messages/${foundUser.connection.conversationId}`);
                              }}
                              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95 text-center"
                            >
                              Open Conversation
                            </button>
                          )}
                        </>
                      )}
                      {foundUser.connection.status === 'pending' && (
                        <p className="text-amber-600 text-xs font-semibold bg-amber-50 p-2.5 rounded-xl border border-amber-100 text-center">
                          ⏳ Request already pending
                        </p>
                      )}
                      {foundUser.connection.status === 'revoked' && (
                        <button
                          onClick={handleStartChat}
                          className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                        >
                          <UserPlus className="w-4 h-4 stroke-[2]" />
                          Re-send Chat Request
                        </button>
                      )}
                      {foundUser.connection.status === 'blocked' && (
                        <p className="text-rose-600 text-xs font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-100 text-center">
                          🚫 You cannot connect with this user.
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={handleStartChat}
                      className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                    >
                      <UserPlus className="w-4 h-4 stroke-[2]" />
                      Send Chat Request
                    </button>
                  )}
                </div>
              )}
                </>
              ) : (
                <div className="h-[300px] overflow-y-auto pr-2 space-y-2">
                  {loadingDiscover ? (
                    <div className="flex justify-center items-center h-full text-slate-400">
                      <Loader className="w-6 h-6 animate-spin" />
                    </div>
                  ) : discoverableUsers.length === 0 ? (
                    <div className="text-center text-xs text-slate-500 mt-10">
                      No discoverable teammates found.
                    </div>
                  ) : (
                    discoverableUsers.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-blue-200 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                            {u.username?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 leading-none mb-1">{u.name || u.username}</p>
                            <p className="text-[10px] text-slate-500">{u.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setNewChatId(u.messagingId);
                            setModalTab('search');
                            setFoundUser(null);
                          }}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          Select
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State for Desktop */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none"></div>
        <div className="text-center p-8 max-w-sm relative">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-500/10 border border-blue-400/20 relative animate-bounce [animation-duration:3s]">
            <MessageCircle className="w-9 h-9 stroke-[1.8]" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"></div>
          </div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Direct Messaging & Teams</h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Select a direct teammate or a team from the sidebar to chat.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MessagesHome;