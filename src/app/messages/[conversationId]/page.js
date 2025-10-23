'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import {
  ArrowLeft, Send, MoreVertical, AlertCircle, Loader
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      
      if (connection?.peer) {
        setPeer(connection.peer);
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
    setTimeout(scrollToBottom, 100);

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
        
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">
          {peer?.username?.[0]?.toUpperCase() || '?'}
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

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {hasMore && (
          <div className="text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load older messages'}
            </button>
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
              const showTime = idx === msgs.length - 1 || 
                msgs[idx + 1]?.senderId !== msg.senderId ||
                (new Date(msgs[idx + 1]?.createdAt) - new Date(msg.createdAt)) > 60000;

              return (
                <div
                  key={msg._id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      isOwn
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    } ${msg.status === 'failed' ? 'opacity-50' : ''}`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                    {showTime && (
                      <div className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'} flex items-center gap-1`}>
                        <span>{formatTime(msg.createdAt)}</span>
                        {msg.status === 'sending' && <span>⏳</span>}
                        {msg.status === 'failed' && <span>❌</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32"
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={handleSend}
            disabled={!messageText.trim() || sending}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatThread;
