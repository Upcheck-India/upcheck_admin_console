'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import {
  ArrowLeft, Send, MoreVertical, Loader, Copy, Check, Users, Trash, Info
} from 'lucide-react';

const POLL_INTERVAL = 4000;
const MESSAGES_LIMIT = 50;

// Format text with bold/italic/code/mentions
const formatText = (text) => {
  if (!text) return null;
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|@[a-zA-Z0-9_]+)/g;
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="bg-slate-100 px-1 rounded font-mono text-sm">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('@')) {
      return <span key={index} className="text-blue-500 font-bold">{part}</span>;
    }
    return part;
  });
};

const TeamChatThread = () => {
  const { user } = useAuth(false);
  const router = useRouter();
  const params = useParams();
  const teamId = params?.teamId;

  const [messages, setMessages] = useState([]);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [messageText]);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams`);
      if (res.ok) {
        const data = await res.json();
        const t = data.teams?.find(x => x._id === teamId);
        if (t) setTeam(t);
        else setError('Team not found');
      }
    } catch (e) {
      console.error(e);
    }
  }, [teamId]);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const url = `/api/team-chat/messages?teamId=${teamId}&limit=${MESSAGES_LIMIT}`;
      const res = await fetch(url, { credentials: 'include' });

      if (!res.ok) throw new Error('Failed to load messages');

      const data = await res.json();
      setMessages(data.messages.reverse());
      setTimeout(scrollToBottom, 100);
      
    } catch (e) {
      console.error('Fetch messages error:', e);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/team-chat/poll?teamId=${teamId}`, { credentials: 'include' });
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
      
      if (data.typingUsers) {
        setTypingUsers(data.typingUsers);
      }
    } catch (e) {
      console.error('Poll error:', e);
    }
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
    fetchTeam();
    fetchMessages();
  }, [teamId, fetchTeam, fetchMessages]);

  useEffect(() => {
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [poll]);

  const handleTyping = (e) => {
    setMessageText(e.target.value);
    if (e.target.value.trim().length > 0) {
      fetch('/api/team-chat/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId })
      }).catch(() => {});
    }
  };

  const copyMessage = (text, msgId) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const deleteMessage = async (messageId, type) => {
    if (!confirm(`Delete message for ${type === 'me' ? 'me' : 'everyone'}?`)) return;
    try {
      await fetch('/api/team-chat/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, messageId, type })
      });
      // optimistically update
      setMessages(prev => prev.map(m => {
        if (m._id === messageId) {
          if (type === 'everyone') return { ...m, body: '[Message deleted]' };
          return null; // hide for me
        }
        return m;
      }).filter(Boolean));
    } catch (e) {
      alert('Failed to delete message');
    }
  };

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || sending) return;

    const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage = {
      _id: clientId,
      teamId,
      senderId: user._id || user.id,
      senderName: user.name || user.username,
      body: text,
      status: 'sending',
      createdAt: new Date().toISOString(),
      readBy: []
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setMessageText('');
    setSending(true);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch('/api/team-chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId, body: text, clientId })
      });

      if (!res.ok) throw new Error('Failed to send');

      const data = await res.json();
      setMessages(prev => prev.map(m =>
        m._id === clientId ? { ...data.message, status: 'sent' } : m
      ));
    } catch (e) {
      console.error('Send error:', e);
      setMessages(prev => prev.map(m =>
        m._id === clientId ? { ...m, status: 'failed' } : m
      ));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Oops!</h2>
        <p className="text-slate-500 mt-2 mb-6">{error}</p>
        <button
          onClick={() => router.push('/messages')}
          className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Back to Messages
        </button>
      </div>
    );
  }

  if (loading && !team) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <Loader className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const isLead = team?.lead?.toString() === (user?._id || user?.id);

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-50 relative overflow-hidden font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 bg-white border-b border-slate-200/80 shadow-sm z-20">
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={() => router.push('/messages')}
            className="p-2 -ml-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            title="Back to list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-md flex-shrink-0 relative">
            <Users className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
              {team?.name || 'Loading...'}
            </h2>
            <p className="text-xs text-slate-500 font-medium truncate">
              {team?.memberCount} members
            </p>
          </div>
          <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
            <Info className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 bg-slate-50 relative">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => {
            const isMe = msg.senderId === (user?._id || user?.id);
            const isDeleted = msg.body === '[Message deleted]';

            return (
              <div key={msg._id} className={`flex w-full group ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs mr-3 flex-shrink-0 mt-1 shadow-sm">
                    {msg.senderName?.[0]?.toUpperCase()}
                  </div>
                )}
                
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                  {!isMe && (
                    <span className="text-[10px] text-slate-500 font-bold mb-1 ml-1">{msg.senderName}</span>
                  )}
                  <div className="relative group/msg flex items-center gap-2">
                    
                    {/* Action Menu (Visible on hover) */}
                    {isMe && (
                      <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 bg-white border border-slate-200 rounded-lg shadow-sm p-0.5">
                        <button onClick={() => copyMessage(msg.body, msg._id)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded" title="Copy text">
                          {copiedMessageId === msg._id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        {!isDeleted && (
                          <>
                            <button onClick={() => deleteMessage(msg._id, 'me')} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded" title="Delete for me"><Trash className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteMessage(msg._id, 'everyone')} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded" title="Delete for everyone"><MoreVertical className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    )}

                    <div className={`relative px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                      isDeleted ? 'bg-slate-100 text-slate-400 italic border border-slate-200' :
                      isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
                    }`}>
                      <div className="whitespace-pre-wrap break-words leading-relaxed font-medium">
                        {isDeleted ? msg.body : formatText(msg.body)}
                      </div>
                      <div className={`flex items-center justify-end gap-1.5 mt-1 -mb-1 ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                        <span className="text-[9px] font-semibold tracking-wide">
                          {formatTime(msg.createdAt)}
                        </span>
                        {isMe && msg.status === 'sending' && <Loader className="w-3 h-3 animate-spin" />}
                      </div>
                    </div>

                    {/* Action Menu for received messages */}
                    {!isMe && (
                      <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 bg-white border border-slate-200 rounded-lg shadow-sm p-0.5">
                        <button onClick={() => copyMessage(msg.body, msg._id)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded">
                          {copiedMessageId === msg._id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => deleteMessage(msg._id, 'me')} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded"><Trash className="w-3.5 h-3.5" /></button>
                        {isLead && !isDeleted && (
                           <button onClick={() => deleteMessage(msg._id, 'everyone')} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded"><MoreVertical className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Typing Indicators */}
      {typingUsers.length > 0 && (
        <div className="px-6 py-2 bg-slate-50 text-[11px] font-semibold text-slate-400 italic">
          {typingUsers.map(u => u.name || u.username).join(', ')} is typing...
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-slate-200/80 px-4 py-4 z-20">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <div className="flex-1 bg-slate-50 border border-slate-200/80 rounded-2xl relative shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={handleTyping}
              onKeyDown={handleKeyDown}
              placeholder="Type a team message... (Use **bold**, *italic*, `code`, @mention)"
              className="w-full bg-transparent px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none max-h-32 focus:outline-none scrollbar-hide font-medium"
              rows={1}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!messageText.trim() || sending}
            className="w-11 h-11 bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/20 active:scale-95 flex-shrink-0"
          >
            {sending ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 -ml-0.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamChatThread;
