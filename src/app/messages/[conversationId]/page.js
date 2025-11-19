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
  const [lastPoll, setLastPoll] = useState(new Date().toISOString());
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
      
      setLastPoll(new Date().toISOString());
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
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push('/messages')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold shadow-md">
            {peer?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
        </div>
        
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">
            {peer?.name || peer?.username || 'Unknown User'}
          </h2>
          <p className="text-xs text-gray-500">{peer?.email}</p>
        </div>

        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <MoreVertical className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {connectionStatus !== 'accepted' && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 text-sm text-yellow-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>Request pending. You can start chatting once the other user accepts.</span>
          </div>
          <button
            onClick={handleCancelRequest}
            className="px-3 py-1.5 text-xs text-red-600 border border-red-600 rounded hover:bg-red-50"
          >
            Cancel Request
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-1 bg-gradient-to-b from-gray-50 to-gray-100"
      >
        {hasMore && (
          <div className="text-center mb-4">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50 transition-all shadow-sm bg-white"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  Loading...
                </span>
              ) : (
                'Load older messages'
              )}
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
              <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
                {date}
              </span>
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
                  <div className="flex items-end gap-2 max-w-[75%]">
                    {!isOwn && isLastInGroup && (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {peer?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    {!isOwn && !isLastInGroup && <div className="w-6" />}
                    
                    <div className="flex flex-col">
                      <div
                        className={`relative px-4 py-2 ${
                          isOwn
                            ? `bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md ${
                                isFirstInGroup ? 'rounded-t-2xl' : 'rounded-t-md'
                              } ${
                                isLastInGroup ? 'rounded-bl-2xl rounded-br-sm' : 'rounded-b-md'
                              }`
                            : `bg-white text-gray-900 border border-gray-200 shadow-sm ${
                                isFirstInGroup ? 'rounded-t-2xl' : 'rounded-t-md'
                              } ${
                                isLastInGroup ? 'rounded-br-2xl rounded-bl-sm' : 'rounded-b-md'
                              }`
                        } ${msg.status === 'failed' ? 'opacity-60' : ''} transition-all hover:shadow-lg`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>
                        
                        {/* Message actions */}
                        <div className="absolute -top-8 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white rounded-lg shadow-lg p-1">
                          <button
                            onClick={() => copyMessage(msg.body, msg._id)}
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                            title="Copy message"
                          >
                            {copiedMessageId === msg._id ? (
                              <Check className="w-3.5 h-3.5 text-green-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-gray-600" />
                            )}
                          </button>
                          {msg.status === 'failed' && (
                            <button
                              onClick={() => retryMessage(msg)}
                              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                              title="Retry"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-red-600" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {showTime && (
                        <div className={`text-xs mt-1 px-2 ${isOwn ? 'text-right text-gray-500' : 'text-left text-gray-500'} flex items-center gap-1.5 ${
                          isOwn ? 'justify-end' : 'justify-start'
                        }`}>
                          <span>{formatTime(msg.createdAt)}</span>
                          {msg.status === 'sending' && (
                            <Loader className="w-3 h-3 animate-spin text-blue-600" />
                          )}
                          {msg.status === 'sent' && isOwn && (
                            <Check className="w-3 h-3 text-gray-400" />
                          )}
                          {msg.status === 'failed' && (
                            <span className="text-red-500 text-xs">Failed</span>
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

      {/* Composer */}
      <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="flex items-end gap-3 relative">
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
            placeholder={connectionStatus === 'accepted' ? 'Type a message...' : 'Waiting for acceptance...'}
            rows={1}
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-blue-500 resize-none transition-all"
            style={{ minHeight: '44px', maxHeight: '120px' }}
            disabled={connectionStatus !== 'accepted'}
          />
          {/* Emoji button (fixed size) */}
          <div className="relative" ref={emojiRef}>
            <button
              type="button"
              onClick={() => setShowEmoji((s) => !s)}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 text-gray-600"
              title="Add emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
            {showEmoji && (
              <div className="absolute bottom-12 right-0 z-20 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-2 grid grid-cols-8 gap-1">
                {['😀','😁','😂','🤣','😊','😍','😘','😜','🤗','👍','👏','🙏','🔥','✨','🎉','❤️','🫶','👌','😉','😎','😇','😅','🤝','💯','✅','❌','🤩','🤔','🤞','😢','😭','😡','🤯','😴'].map((e, i) => (
                  <button
                    key={`${e}-${i}`}
                    type="button"
                    onClick={() => insertEmoji(e)}
                    className="text-xl leading-none p-1 hover:bg-gray-100 rounded"
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
            className="p-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-full hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 shadow-lg"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-400 flex items-center justify-between">
          <span>Press Enter to send, Shift+Enter for new line</span>
          {messageText.length > 0 && (
            <span className="text-gray-500">{messageText.length} characters</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatThread;