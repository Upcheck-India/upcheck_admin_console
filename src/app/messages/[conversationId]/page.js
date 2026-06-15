'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import {
  ArrowLeft, Send, MoreVertical, AlertCircle, Loader, Copy, RotateCcw, Check, Smile
} from 'lucide-react';

const POLL_INTERVAL = 5000;
const MESSAGES_LIMIT = 50;

const ChatThread = () => {
  const { user } = useAuth(false);
  const router = useRouter();
  const params = useParams();
  const conversationId = params?.conversationId;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState('');
  const [peer, setPeer] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastPoll, setLastPoll] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [peerId, setPeerId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const textareaRef = useRef(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [messageText]);

  // Close emoji popover on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!showEmoji) return;
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmoji(false);
      }
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

  const handleCancelRequest = async () => {
    if (!peerId) return;
    if (!confirm('Cancel this chat request?')) return;
    try {
      const res = await fetch('/api/chat/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ peerId, block: false })
      });
      if (res.ok) {
        router.push('/messages');
      }
    } catch (e) {
      console.error('Cancel request error:', e);
    }
  };

  const fetchMessages = useCallback(async (before = null, append = false) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      const url = `/api/chat/messages?conversationId=${conversationId}&limit=${MESSAGES_LIMIT}${before ? `&before=${before}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });

      if (!res.ok) {
        if (res.status === 404) {
          setError('Conversation not found');
        }
        throw new Error('Failed to load messages');
      }

      const data = await res.json();
      
      if (append) {
        setMessages(prev => [...data.messages.reverse(), ...prev]);
      } else {
        setMessages(data.messages.reverse());
        setTimeout(scrollToBottom, 100);
      }
      
      setHasMore(data.hasMore);
    } catch (e) {
      console.error('Fetch messages error:', e);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [conversationId]);

  const fetchConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/connections', { credentials: 'include' });
      if (!res.ok) return;
      
      const data = await res.json();
      const connection = data.connections.find(c => c.conversationId === conversationId);
      
      if (connection) {
        if (connection.peer) setPeer(connection.peer);
        if (connection.status) setConnectionStatus(connection.status);
        if (connection.peer?.id) setPeerId(connection.peer.id);
      }
    } catch (e) {
      console.error('Fetch connection error:', e);
    }
  }, [conversationId]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/chat/poll?conversationId=${conversationId}&since=${encodeURIComponent(lastPoll)}`,
        { credentials: 'include' }
      );
      
      if (!res.ok) return;
      
      const data = await res.json();
      
      if (data.newMessages?.length > 0) {
        setMessages(prev => {
          const existing = new Set(prev.map(m => m._id));
          const newMsgs = data.newMessages.filter(m => !existing.has(m._id));
          if (newMsgs.length > 0) {
            setTimeout(scrollToBottom, 100);
            return [...prev, ...newMsgs];
          }
          return prev;
        });
      }
      
      if (data.serverTimestamp) {
        setLastPoll(data.serverTimestamp);
      }
    } catch (e) {
      console.error('Poll error:', e);
    }
  }, [conversationId, lastPoll]);

  useEffect(() => {
    if (!conversationId) return;
    fetchMessages();
    fetchConnection();
  }, [conversationId, fetchMessages, fetchConnection]);

  useEffect(() => {
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [poll]);

  const retryMessage = async (msg) => {
    if (!msg.clientId) return;
    
    setMessages(prev => prev.map(m =>
      m._id === msg._id ? { ...m, status: 'sending' } : m
    ));

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversationId,
          body: msg.body,
          clientId: msg.clientId
        })
      });

      if (!res.ok) throw new Error('Failed to send');

      const data = await res.json();
      setMessages(prev => prev.map(m =>
        m._id === msg._id ? { ...data.message, status: 'sent' } : m
      ));
    } catch (e) {
      console.error('Retry error:', e);
      setMessages(prev => prev.map(m =>
        m._id === msg._id ? { ...m, status: 'failed' } : m
      ));
    }
  };

  const copyMessage = (text, msgId) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || sending) return;

    const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage = {
      _id: clientId,
      conversationId,
      senderId: user._id,
      body: text,
      status: 'sending',
      createdAt: new Date().toISOString(),
      clientId
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setMessageText('');
    setSending(true);
    setIsTyping(false);
    setTimeout(() => scrollToBottom(true), 100);

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversationId,
          body: text,
          clientId
        })
      });

      if (!res.ok) throw new Error('Failed to send');

      const data = await res.json();
      
      setMessages(prev => prev.map(m =>
        m.clientId === clientId ? { ...data.message, status: 'sent' } : m
      ));
    } catch (e) {
      console.error('Send error:', e);
      setMessages(prev => prev.map(m =>
        m.clientId === clientId ? { ...m, status: 'failed' } : m
      ));
    } finally {
      setSending(false);
    }
  };

  const loadMore = () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    const oldestId = messages[0]._id;
    fetchMessages(oldestId, true);
  };

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-gray-500">
        <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
        <p className="text-lg font-medium">{error}</p>
        <button
          onClick={() => router.push('/messages')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Back to Messages
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => router.push('/messages')}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
          
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md text-sm border-2 border-white">
              {peer?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
          </div>
          
          <div>
            <h2 className="text-md font-bold text-slate-800 tracking-tight leading-none mb-1">
              {peer?.name || peer?.username || 'Teammate'}
            </h2>
            <p className="text-xs text-slate-400 font-medium">{peer?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {connectionStatus !== 'accepted' && (
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 text-xs text-amber-800 flex items-center justify-between shadow-inner animate-pulse">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="font-medium">Connection request is pending. Chatting will enable once they accept.</span>
          </div>
          <button
            onClick={handleCancelRequest}
            className="px-3 py-1.5 text-[10px] text-rose-600 border border-rose-200 hover:border-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all font-bold"
          >
            Cancel Request
          </button>
        </div>
      )}

      {/* Messages List */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-3 bg-gradient-to-b from-slate-50 to-slate-100/50"
      >
        {hasMore && (
          <div className="text-center mb-6">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-xs text-blue-600 hover:text-blue-700 bg-white border border-slate-200 hover:border-blue-600 rounded-xl disabled:opacity-50 transition-all shadow-sm font-semibold inline-flex items-center gap-2 active:scale-95"
            >
              {loadingMore ? (
                <>
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  Loading older messages...
                </>
              ) : (
                'Load older messages'
              )}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-300 shadow-md shadow-slate-100/50 mb-4 animate-pulse">
              <Send className="w-6 h-6 stroke-[1.8]" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">No messages yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px] leading-relaxed">Say hello to your teammate and start collaborating!</p>
          </div>
        )}

        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date} className="space-y-3">
            <div className="flex items-center justify-center my-6">
              <div className="h-[1px] bg-slate-200 flex-1"></div>
              <span className="px-3.5 py-1 bg-white border border-slate-200/80 text-slate-500 text-[10px] font-bold uppercase tracking-wider rounded-full mx-4 shadow-sm">
                {date}
              </span>
              <div className="h-[1px] bg-slate-200 flex-1"></div>
            </div>
            
            {msgs.map((msg, idx) => {
              const isOwn = msg.senderId === user?._id || msg.senderId === user?.id;
              const prevMsg = idx > 0 ? msgs[idx - 1] : null;
              const nextMsg = idx < msgs.length - 1 ? msgs[idx + 1] : null;
              const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;
              const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;
              const showTime = isLastInGroup || 
                (nextMsg && (new Date(nextMsg.createdAt) - new Date(msg.createdAt)) > 60000);

              return (
                <div
                  key={msg._id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${isLastInGroup ? 'mb-3' : 'mb-0.5'} group`}
                >
                  <div className="flex items-end gap-2.5 max-w-[75%]">
                    {!isOwn && isLastInGroup && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-sm">
                        {peer?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    {!isOwn && !isLastInGroup && <div className="w-7" />}
                    
                    <div className="flex flex-col">
                      <div
                        className={`relative px-4 py-2.5 ${
                          isOwn
                            ? `bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/10 ${
                                isFirstInGroup ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-tr-md rounded-br-sm'
                              }`
                            : `bg-white text-slate-800 border border-slate-200/80 shadow-sm ${
                                isFirstInGroup ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl rounded-tl-md rounded-bl-sm'
                              }`
                        } ${msg.status === 'failed' ? 'border-rose-300 bg-rose-50/80 text-rose-900 shadow-none' : ''} transition-all duration-200 hover:shadow-md`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed select-text">{msg.body}</p>
                        
                        {/* Hover Quick Actions */}
                        <div className={`absolute -top-9 ${isOwn ? 'right-2' : 'left-2'} opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1 bg-white border border-slate-100 rounded-lg shadow-md p-0.5 z-20`}>
                          <button
                            onClick={() => copyMessage(msg.body, msg._id)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors"
                            title="Copy Message"
                          >
                            {copiedMessageId === msg._id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {msg.status === 'failed' && (
                            <button
                              onClick={() => retryMessage(msg)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Retry Send"
                            >
                              <RotateCcw className="w-3.5 h-3.5 stroke-[2]" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {showTime && (
                        <div className={`text-[10px] mt-1.5 px-2 text-slate-400 font-medium flex items-center gap-1 ${
                          isOwn ? 'justify-end text-right' : 'justify-start text-left'
                        }`}>
                          <span>{formatTime(msg.createdAt)}</span>
                          {msg.status === 'sending' && (
                            <Loader className="w-2.5 h-2.5 animate-spin text-blue-500" />
                          )}
                          {msg.status === 'sent' && isOwn && (
                            <Check className="w-2.5 h-2.5 text-slate-400" />
                          )}
                          {msg.status === 'failed' && (
                            <span className="text-rose-500 font-semibold text-[9px] uppercase tracking-wider">Failed</span>
                          )}
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

      {/* Composer Input Bar */}
      <div className="bg-white border-t border-slate-100 p-4 shadow-lg z-10">
        <div className="flex items-end gap-3.5 max-w-4xl mx-auto relative">
          <textarea
            ref={textareaRef}
            value={messageText}
            onChange={(e) => {
              setMessageText(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (connectionStatus === 'accepted' && messageText.trim()) handleSend();
              }
            }}
            placeholder={connectionStatus === 'accepted' ? 'Type a message...' : 'Connection pending. Messaging disabled.'}
            rows={1}
            className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-200/60 rounded-2xl focus:outline-none focus:bg-white focus:border-blue-500 resize-none transition-all duration-200 text-sm text-slate-800 placeholder-slate-400 min-h-[44px] max-h-[120px] leading-relaxed"
            disabled={connectionStatus !== 'accepted'}
          />
          
          {/* Emoji Popover */}
          <div className="relative" ref={emojiRef}>
            <button
              type="button"
              onClick={() => setShowEmoji((s) => !s)}
              disabled={connectionStatus !== 'accepted'}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200/80 hover:bg-slate-50 text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
              title="Add Emoji"
            >
              <Smile className="w-5 h-5 stroke-[1.8]" />
            </button>
            {showEmoji && (
              <div className="absolute bottom-12 right-0 z-50 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl p-2.5 grid grid-cols-8 gap-1.5 animate-fadeIn">
                {['😀','😁','😂','🤣','😊','😍','😘','😜','🤗','👍','👏','🙏','🔥','✨','🎉','❤️','🫶','👌','😉','😎','😇','😅','🤝','💯','✅','❌','🤩','🤔','🤞','😢','😭','😡','🤯','😴'].map((e, i) => (
                  <button
                    key={`${e}-${i}`}
                    type="button"
                    onClick={() => insertEmoji(e)}
                    className="text-lg leading-none p-1.5 hover:bg-slate-50 rounded-lg transition-colors"
                    aria-label={`emoji ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={!messageText.trim() || sending || connectionStatus !== 'accepted'}
            className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95"
            title="Send Message"
          >
            <Send className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>
        <div className="mt-2 max-w-4xl mx-auto flex items-center justify-between text-[10px] text-slate-400 font-medium px-1">
          <span>Enter to send, Shift + Enter for newline</span>
          {messageText.length > 0 && (
            <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-500 font-semibold">{messageText.length} characters</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatThread;