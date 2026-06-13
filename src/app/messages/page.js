'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import TopNav from '../components/TopNav';

import {
  MessageCircle, Search, Settings, Plus, X, Check,
  AlertCircle, UserPlus, Copy, CheckCircle,
  ArrowLeft, Send, MoreVertical, Loader, RotateCcw, Smile
} from 'lucide-react';

const POLL_INTERVAL = 5000;
const MESSAGES_LIMIT = 50;

/* ─────────────────────── Inline Chat Thread ─────────────────────── */
function ChatThread({ conversationId, user, onBack, onConnectionsRefresh }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState('');
  const [peer, setPeer] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastPoll, setLastPoll] = useState(new Date().toISOString());
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [peerId, setPeerId] = useState(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [messageText]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!showEmoji) return;
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showEmoji]);

  const insertEmoji = (emoji) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? messageText.length;
    const end = ta.selectionEnd ?? messageText.length;
    const next = messageText.slice(0, start) + emoji + messageText.slice(end);
    setMessageText(next);
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + emoji.length;
      ta.setSelectionRange(caret, caret);
    });
  };

  const fetchMessages = useCallback(async (before = null, append = false) => {
    try {
      if (!append) setLoading(true); else setLoadingMore(true);
      const url = `/api/chat/messages?conversationId=${conversationId}&limit=${MESSAGES_LIMIT}${before ? `&before=${before}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) { if (res.status === 404) setError('Conversation not found'); throw new Error(); }
      const data = await res.json();
      if (append) setMessages(prev => [...data.messages.reverse(), ...prev]);
      else { setMessages(data.messages.reverse()); setTimeout(scrollToBottom, 100); }
      setHasMore(data.hasMore);
    } catch { setError('Failed to load messages'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [conversationId]);

  const fetchConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/connections', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const conn = data.connections.find(c => c.conversationId === conversationId);
      if (conn) {
        if (conn.peer) setPeer(conn.peer);
        if (conn.status) setConnectionStatus(conn.status);
        if (conn.peer?.id) setPeerId(conn.peer.id);
      }
    } catch { /* silent */ }
  }, [conversationId]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/poll?conversationId=${conversationId}&since=${encodeURIComponent(lastPoll)}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.newMessages?.length > 0) {
        setMessages(prev => {
          const existing = new Set(prev.map(m => m._id));
          const newMsgs = data.newMessages.filter(m => !existing.has(m._id));
          if (newMsgs.length > 0) { setTimeout(scrollToBottom, 100); return [...prev, ...newMsgs]; }
          return prev;
        });
        onConnectionsRefresh?.();
      }
      setLastPoll(new Date().toISOString());
    } catch { /* silent */ }
  }, [conversationId, lastPoll, onConnectionsRefresh]);

  useEffect(() => {
    if (!conversationId) return;
    setMessages([]); setError(''); setLoading(true); setLastPoll(new Date().toISOString());
    fetchMessages();
    fetchConnection();
  }, [conversationId, fetchMessages, fetchConnection]);

  useEffect(() => {
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [poll]);

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || sending) return;
    const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimistic = { _id: clientId, conversationId, senderId: user._id, body: text, status: 'sending', createdAt: new Date().toISOString(), clientId };
    setMessages(prev => [...prev, optimistic]);
    setMessageText('');
    setSending(true);
    setTimeout(() => scrollToBottom(true), 100);
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ conversationId, body: text, clientId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(prev => prev.map(m => m.clientId === clientId ? { ...data.message, status: 'sent' } : m));
      onConnectionsRefresh?.();
    } catch {
      setMessages(prev => prev.map(m => m.clientId === clientId ? { ...m, status: 'failed' } : m));
    } finally { setSending(false); }
  };

  const retryMessage = async (msg) => {
    if (!msg.clientId) return;
    setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, status: 'sending' } : m));
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ conversationId, body: msg.body, clientId: msg.clientId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(prev => prev.map(m => m._id === msg._id ? { ...data.message, status: 'sent' } : m));
    } catch {
      setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, status: 'failed' } : m));
    }
  };

  const copyMessage = (text, msgId) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleCancelRequest = async () => {
    if (!peerId || !confirm('Cancel this chat request?')) return;
    const res = await fetch('/api/chat/revoke', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ peerId, block: false }),
    });
    if (res.ok) onBack();
  };

  const formatTime = (date) => new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const formatDate = (date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.createdAt);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  if (loading) return (
    <div className="flex flex-col flex-1 items-center justify-center bg-gray-50">
      <Loader className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col flex-1 items-center justify-center bg-gray-50 text-gray-500">
      <AlertCircle className="w-16 h-16 mb-4 text-red-400" />
      <p className="text-lg font-medium">{error}</p>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Chat header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="md:hidden p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold shadow-md">
            {peer?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">{peer?.name || peer?.username || 'Unknown User'}</h2>
          <p className="text-xs text-gray-500">{peer?.email}</p>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <MoreVertical className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Pending warning */}
      {connectionStatus !== 'accepted' && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 text-sm text-yellow-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>Request pending. You can start chatting once the other user accepts.</span>
          </div>
          <button onClick={handleCancelRequest} className="px-3 py-1.5 text-xs text-red-600 border border-red-600 rounded hover:bg-red-50">
            Cancel Request
          </button>
        </div>
      )}

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-1 bg-gradient-to-b from-gray-50 to-gray-100">
        {hasMore && (
          <div className="text-center mb-4">
            <button onClick={() => { if (messages.length) fetchMessages(messages[0]._id, true); }} disabled={loadingMore}
              className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50 bg-white shadow-sm">
              {loadingMore ? <span className="flex items-center gap-2"><Loader className="w-4 h-4 animate-spin" />Loading...</span> : 'Load older messages'}
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Send className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm mt-2">Start the conversation!</p>
          </div>
        )}
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            <div className="flex items-center justify-center my-4">
              <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">{date}</span>
            </div>
            {msgs.map((msg, idx) => {
              const isOwn = msg.senderId === user?._id || msg.senderId === user?.id;
              const prevMsg = idx > 0 ? msgs[idx - 1] : null;
              const nextMsg = idx < msgs.length - 1 ? msgs[idx + 1] : null;
              const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;
              const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;
              const showTime = isLastInGroup || (nextMsg && (new Date(nextMsg.createdAt) - new Date(msg.createdAt)) > 60000);
              return (
                <div key={msg._id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${isLastInGroup ? 'mb-3' : 'mb-0.5'} group`}>
                  <div className="flex items-end gap-2 max-w-[75%]">
                    {!isOwn && isLastInGroup && (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {peer?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    {!isOwn && !isLastInGroup && <div className="w-6" />}
                    <div className="flex flex-col">
                      <div className={`relative px-4 py-2 ${
                        isOwn
                          ? `bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md ${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-t-md'} ${isLastInGroup ? 'rounded-bl-2xl rounded-br-sm' : 'rounded-b-md'}`
                          : `bg-white text-gray-900 border border-gray-200 shadow-sm ${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-t-md'} ${isLastInGroup ? 'rounded-br-2xl rounded-bl-sm' : 'rounded-b-md'}`
                      } ${msg.status === 'failed' ? 'opacity-60' : ''} transition-all hover:shadow-lg`}>
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>
                        <div className="absolute -top-8 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white rounded-lg shadow-lg p-1">
                          <button onClick={() => copyMessage(msg.body, msg._id)} className="p-1.5 hover:bg-gray-100 rounded" title="Copy">
                            {copiedMessageId === msg._id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-600" />}
                          </button>
                          {msg.status === 'failed' && (
                            <button onClick={() => retryMessage(msg)} className="p-1.5 hover:bg-gray-100 rounded" title="Retry">
                              <RotateCcw className="w-3.5 h-3.5 text-red-600" />
                            </button>
                          )}
                        </div>
                      </div>
                      {showTime && (
                        <div className={`text-xs mt-1 px-2 text-gray-500 flex items-center gap-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <span>{formatTime(msg.createdAt)}</span>
                          {msg.status === 'sending' && <Loader className="w-3 h-3 animate-spin text-blue-600" />}
                          {msg.status === 'sent' && isOwn && <Check className="w-3 h-3 text-gray-400" />}
                          {msg.status === 'failed' && <span className="text-red-500 text-xs">Failed</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="bg-white border-t border-gray-200 p-3 shadow-lg shrink-0">
        <div className="flex items-end gap-2 relative">
          <textarea
            ref={textareaRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (connectionStatus === 'accepted' && messageText.trim()) handleSend();
              }
            }}
            placeholder={connectionStatus === 'accepted' ? 'Type a message...' : 'Waiting for acceptance...'}
            rows={1}
            className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 resize-none transition-all text-sm"
            style={{ minHeight: '40px', maxHeight: '120px' }}
            disabled={connectionStatus !== 'accepted'}
          />
          <div className="relative" ref={emojiRef}>
            <button type="button" onClick={() => setShowEmoji(s => !s)}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 text-gray-600">
              <Smile className="w-5 h-5" />
            </button>
            {showEmoji && (
              <div className="absolute bottom-12 right-0 z-20 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-2 grid grid-cols-8 gap-1">
                {['😀','😁','😂','🤣','😊','😍','😘','😜','🤗','👍','👏','🙏','🔥','✨','🎉','❤️','🫶','👌','😉','😎','😇','😅','🤝','💯','✅','❌','🤩','🤔','🤞','😢','😭','😡','🤯','😴'].map((e, i) => (
                  <button key={`${e}-${i}`} type="button" onClick={() => insertEmoji(e)}
                    className="text-xl leading-none p-1 hover:bg-gray-100 rounded" aria-label={`emoji ${e}`}>{e}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleSend}
            disabled={!messageText.trim() || sending || connectionStatus !== 'accepted'}
            className="p-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-full hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md">
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-1 text-xs text-gray-400 flex justify-between">
          <span>Enter to send · Shift+Enter for new line</span>
          {messageText.length > 0 && <span>{messageText.length} chars</span>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Main Messages Page ─────────────────────── */
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
  const [activeConversationId, setActiveConversationId] = useState(null);

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
      if (res.ok) { await fetchConnections(); window.location.reload(); }
      else alert(data.error || 'Failed to generate Messaging ID');
    } catch { alert('Failed to generate Messaging ID'); }
  };

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/poll?since=${encodeURIComponent(lastPoll)}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.newMessages?.length > 0 || data.pendingRequests?.length > 0 || data.connectionUpdates?.length > 0) {
        fetchConnections();
      }
      setLastPoll(new Date().toISOString());
    } catch { /* silent */ }
  }, [lastPoll, fetchConnections]);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);
  useEffect(() => { setVisibleCount(20); }, [connections.length]);
  useEffect(() => {
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [poll]);

  const handleFindUser = async () => {
    if (!newChatId.trim()) return;
    setFindingUser(true); setError(''); setFoundUser(null);
    try {
      const res = await fetch('/api/chat/find-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ messagingId: newChatId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'User not found'); return; }
      setFoundUser(data);
    } catch { setError('Failed to find user'); }
    finally { setFindingUser(false); }
  };

  const handleStartChat = async () => {
    if (!foundUser?.user?.id) return;
    try {
      const res = await fetch('/api/chat/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ peerId: foundUser.user.id }),
      });
      const data = await res.json();
      if (res.ok && data.conversationId) {
        setShowNewChat(false); setNewChatId(''); setFoundUser(null);
        await fetchConnections();
        setActiveConversationId(data.conversationId);
      }
    } catch { setError('Failed to start chat'); }
  };

  const handleAccept = async (peerId) => {
    try {
      const res = await fetch('/api/chat/accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ peerId }),
      });
      if (res.ok) fetchConnections();
    } catch { /* silent */ }
  };

  const handleRevoke = async (peerId, block = false) => {
    if (!confirm(block ? 'Block this user?' : 'Remove this connection?')) return;
    try {
      const res = await fetch('/api/chat/revoke', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ peerId, block }),
      });
      if (res.ok) fetchConnections();
    } catch { /* silent */ }
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
    const d = new Date(date); const now = new Date(); const diff = now - d;
    const minutes = Math.floor(diff / 60000); const hours = Math.floor(diff / 3600000); const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return d.toLocaleDateString();
  };

  const filteredConnections = connections.filter(c => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return c.peer?.username?.toLowerCase().includes(s) || c.peer?.name?.toLowerCase().includes(s) || c.peer?.email?.toLowerCase().includes(s);
  });

  const acceptedChats = filteredConnections.filter(c => c.status === 'accepted');
  const pendingRequests = filteredConnections.filter(c => c.status === 'pending');
  const activeChat = connections.find(c => c.conversationId === activeConversationId);

  if (authLoading || loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen">
      <TopNav />
      <div className="flex flex-1 min-h-0 bg-white">

        {/* ── Left Sidebar ── */}
        <div className={`${activeConversationId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r border-gray-200 flex-col shrink-0`}>

          {/* Sidebar header */}
          <div className="p-4 border-b border-gray-200 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-gray-900">Messages</h1>
              <div className="flex items-center gap-1">
                <button onClick={() => setShowNewChat(true)} disabled={!user?.messagingId}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  title={user?.messagingId ? 'New chat' : 'Generate Messaging ID to start'}>
                  <Plus className="w-5 h-5" />
                </button>
                <button onClick={() => router.push('/messages/settings')} className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg" title="Settings">
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messaging ID bar */}
            <div className="mb-3 p-2.5 bg-blue-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Your Messaging ID</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-blue-700 truncate">{user?.messagingId || 'Not set'}</code>
                {user?.messagingId ? (
                  <button onClick={copyMessagingId} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Copy ID">
                    {copiedId ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                ) : (
                  <button onClick={generateMessagingId} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Generate</button>
                )}
              </div>
            </div>

            {!user?.messagingId && (
              <div className="mb-3 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-800">Generate your Messaging ID to start or receive chat requests.</p>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search conversations..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <div className="p-3 bg-yellow-50 border-b border-yellow-200 shrink-0">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Pending ({pendingRequests.length})</h3>
              {pendingRequests.map((req) => (
                <div key={req._id} className="flex items-center gap-2 p-2 bg-white rounded-lg mb-1.5 last:mb-0">
                  <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-semibold flex-shrink-0 text-sm">
                    {req.peer?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{req.peer?.name || req.peer?.username}</p>
                    <p className="text-xs text-gray-500">wants to chat</p>
                  </div>
                  {req.initiatedBy === (user?.id || user?._id) ? (
                    <button onClick={() => handleRevoke(req.peerId)} className="px-2 py-1 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50">Cancel</button>
                  ) : (
                    <div className="flex gap-1">
                      <button onClick={() => handleAccept(req.peerId)} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                      <button onClick={() => handleRevoke(req.peerId)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {acceptedChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                <MessageCircle className="w-14 h-14 mb-3 text-gray-300" />
                <p className="font-medium">No conversations yet</p>
                <p className="text-xs text-center mt-1">Click <Plus className="w-3 h-3 inline" /> to start a chat</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {acceptedChats.slice(0, visibleCount).map((chat) => (
                  <li key={chat._id}
                    onClick={() => setActiveConversationId(chat.conversationId)}
                    className={`p-3 cursor-pointer transition-colors ${activeConversationId === chat.conversationId ? 'bg-blue-50 border-r-2 border-blue-600' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm shadow-sm">
                        {chat.peer?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900 truncate">{chat.peer?.name || chat.peer?.username || 'Unknown'}</p>
                          <span className="text-xs text-gray-400 ml-1 flex-shrink-0">{formatTime(chat.lastMessage?.createdAt || chat.updatedAt)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-gray-500 truncate">{chat.lastMessage?.body || 'No messages yet'}</p>
                          {chat.unreadCount > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full flex-shrink-0">{chat.unreadCount}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
                {acceptedChats.length > visibleCount && (
                  <li className="p-3 text-center">
                    <button onClick={() => setVisibleCount(c => c + 20)} className="text-sm text-blue-600 hover:text-blue-800">Load more</button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className={`${activeConversationId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0`}>
          {activeConversationId ? (
            <ChatThread
              key={activeConversationId}
              conversationId={activeConversationId}
              user={user}
              onBack={() => setActiveConversationId(null)}
              onConnectionsRefresh={fetchConnections}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center bg-gray-50">
              <div className="text-center text-gray-400">
                <MessageCircle className="w-20 h-20 mx-auto mb-4 text-gray-200" />
                <p className="text-lg font-semibold text-gray-500">Select a conversation</p>
                <p className="text-sm mt-1 text-gray-400">Choose a chat from the list to start messaging</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Start New Chat</h2>
              <button onClick={() => { setShowNewChat(false); setNewChatId(''); setFoundUser(null); setError(''); }}
                className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter User's Messaging ID</label>
                <div className="flex gap-2">
                  <input type="text" value={newChatId} onChange={(e) => setNewChatId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleFindUser()}
                    placeholder="e.g., a1b2c3d4e5f6..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  <button onClick={handleFindUser} disabled={findingUser || !newChatId.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
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
                      <p className="font-semibold text-gray-900">{foundUser.user.name || foundUser.user.username}</p>
                      <p className="text-sm text-gray-600 truncate">{foundUser.user.email}</p>
                    </div>
                  </div>
                  {foundUser.connection ? (
                    <div className="space-y-2">
                      {foundUser.connection.status === 'accepted' && (
                        <>
                          <p className="text-green-600 text-sm">✓ Already connected</p>
                          {foundUser.connection.conversationId && (
                            <button onClick={() => { setShowNewChat(false); setNewChatId(''); setFoundUser(null); setError(''); setActiveConversationId(foundUser.connection.conversationId); }}
                              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Open Chat</button>
                          )}
                        </>
                      )}
                      {foundUser.connection.status === 'pending' && <p className="text-yellow-600 text-sm">⏳ Request pending</p>}
                      {foundUser.connection.status === 'revoked' && (
                        <button onClick={handleStartChat} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                          <UserPlus className="w-4 h-4" /> Re-send Chat Request
                        </button>
                      )}
                      {foundUser.connection.status === 'blocked' && <p className="text-red-600 text-sm">🚫 You cannot send a request to this user.</p>}
                    </div>
                  ) : (
                    <button onClick={handleStartChat} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                      <UserPlus className="w-4 h-4" /> Send Chat Request
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesHome;