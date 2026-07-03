'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import TopNav from '../../components/TopNav';
import ChatSettingsPanel from '../../components/messages/ChatSettingsPanel';
import MessageActionMenu from '../../components/messages/MessageActionMenu';
import NewMessagesButton from '../../components/messages/NewMessagesButton';
import MessageImage from '../../components/messages/MessageImage';
import ForwardModal from '../../components/messages/ForwardModal';
import PluginsPanel from '../../components/messages/PluginsPanel';
import { getChatTheme, getChatThemeById, setChatTheme as persistChatTheme } from '../../utils/chatThemes';
import { useTimeFormat, formatMessageTime } from '../../utils/timeFormat';
import { formatTypingText } from '../../utils/typingText';
import { uploadChatImage, getPastedImageFile } from '../../utils/chatMedia';
import { sendToTarget } from '../../utils/chatSend';
import useOnlineUsers from '../../../hooks/useOnlineUsers';

import {
  ArrowLeft, Send, AlertCircle, Loader, Copy, RotateCcw, Check, CheckCheck, Smile,
  Settings as SettingsIcon, ShieldAlert, ImageIcon, Reply, Forward, Trash2, Info, X
} from 'lucide-react';

const POLL_INTERVAL = 5000;
const MESSAGES_LIMIT = 50;

const ChatThread = () => {
  const { user } = useAuth(false);
  const router = useRouter();
  const params = useParams();
  const conversationId = params?.conversationId;
  const timeFormat = useTimeFormat();
  const onlineUsers = useOnlineUsers();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState('');
  const [peer, setPeer] = useState(null);
  const isPeerOnline = !!peer?.username && onlineUsers.some(u => u.username === peer.username);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastPoll, setLastPoll] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [peerId, setPeerId] = useState(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const textareaRef = useRef(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [theme, setTheme] = useState(getChatThemeById('default'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [mutedUntil, setMutedUntil] = useState(null);

  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef(null);

  const isNearBottomRef = useRef(true);
  const [unseenCount, setUnseenCount] = useState(0);

  const [replyToMessage, setReplyToMessage] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) setUnseenCount(0);
  };

  useEffect(() => {
    if (conversationId) setTheme(getChatTheme(`dm-${conversationId}`));
  }, [conversationId]);

  const handleSelectTheme = (chatId, themeId) => {
    persistChatTheme(chatId, themeId);
    setTheme(getChatThemeById(themeId));
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
        setIsMuted(!!connection.isMuted);
        setMutedUntil(connection.mutedUntil || null);
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
          // Reconcile by _id AND clientId — a poll tick can race ahead of
          // this tab's own send() response and observe the server message
          // before the optimistic placeholder (still keyed by clientId) is
          // replaced, which previously showed the same message twice.
          const byId = new Map(data.newMessages.map(m => [m._id, m]));
          const byClientId = new Map(data.newMessages.filter(m => m.clientId).map(m => [m.clientId, m]));
          const updated = prev.map(m => {
            if (byId.has(m._id)) {
              const u = byId.get(m._id);
              byId.delete(m._id);
              if (u.clientId) byClientId.delete(u.clientId);
              return u;
            }
            if (m.clientId && byClientId.has(m.clientId)) {
              const u = byClientId.get(m.clientId);
              byId.delete(u._id);
              byClientId.delete(m.clientId);
              return u;
            }
            return m;
          });
          const novel = Array.from(byId.values());
          if (novel.length === 0) return updated;

          const myId = user?.id || user?._id;
          const novelFromPeer = novel.filter(m => m.senderId !== myId);
          if (isNearBottomRef.current) {
            setTimeout(() => scrollToBottom(true), 100);
          } else if (novelFromPeer.length > 0) {
            setUnseenCount(c => c + novelFromPeer.length);
          }
          return [...updated, ...novel];
        });
      }

      if (data.typingUsers) {
        setTypingUsers(data.typingUsers);
      }

      if (data.serverTimestamp) {
        setLastPoll(data.serverTimestamp);
      }
    } catch (e) {
      console.error('Poll error:', e);
    }
  }, [conversationId, lastPoll, user]);

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
          clientId: msg.clientId,
          mediaUrl: msg.mediaUrl,
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

  const copyImage = async (mediaUrl) => {
    try {
      const res = await fetch(mediaUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new window.ClipboardItem({ [blob.type]: blob })]);
    } catch (e) {
      console.error('Copy image failed:', e);
      alert('Failed to copy image to clipboard');
    }
  };

  const handleTyping = (e) => {
    setMessageText(e.target.value);
    if (e.target.value.trim().length > 0 && !typingTimeoutRef.current) {
      fetch('/api/chat/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ conversationId })
      }).catch(() => {});
      typingTimeoutRef.current = setTimeout(() => {
        typingTimeoutRef.current = null;
      }, 2000);
    }
  };

  const sendMessage = async ({ body, mediaUrl }) => {
    if ((!body || !body.trim()) && !mediaUrl) return;
    if (sending || !user) return;

    const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage = {
      _id: clientId,
      conversationId,
      senderId: user.id || user._id,
      body: body?.trim() || (mediaUrl ? '📷 Photo' : ''),
      type: mediaUrl ? 'image' : 'text',
      mediaUrl,
      status: 'sending',
      createdAt: new Date().toISOString(),
      clientId,
      replyTo: replyToMessage?._id || null,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setMessageText('');
    setReplyToMessage(null);
    setSending(true);
    setTimeout(() => scrollToBottom(true), 100);

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversationId,
          body: body?.trim() || '',
          mediaUrl,
          clientId,
          replyToId: optimisticMessage.replyTo,
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

  const handleSend = () => sendMessage({ body: messageText });

  const handlePickImage = () => fileInputRef.current?.click();

  const handleImageSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingImage(true);
    try {
      const mediaUrl = await uploadChatImage(file, 'dm', conversationId);
      await sendMessage({ body: messageText, mediaUrl });
      setMessageText('');
    } catch (err) {
      alert(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePaste = async (e) => {
    const file = getPastedImageFile(e);
    if (!file) return;
    e.preventDefault();
    setUploadingImage(true);
    try {
      const mediaUrl = await uploadChatImage(file, 'dm', conversationId);
      await sendMessage({ body: messageText, mediaUrl });
      setMessageText('');
    } catch (err) {
      alert(err.message || 'Failed to upload pasted image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteMessage = async (messageId, forEveryone) => {
    if (!confirm(forEveryone ? 'Delete this message for everyone?' : 'Delete this message for you?')) return;
    try {
      await fetch(`/api/chat/messages/${messageId}/delete?forEveryone=${forEveryone}`, {
        method: 'POST',
        credentials: 'include',
      });
      setMessages(prev => {
        if (forEveryone) {
          return prev.map(m => m._id === messageId
            ? { ...m, body: '[Message deleted]', deletedForEveryone: true, type: 'text', mediaUrl: undefined }
            : m);
        }
        return prev.filter(m => m._id !== messageId);
      });
    } catch (e) {
      alert('Failed to delete message');
    }
  };

  const handleSetMute = async (option) => {
    try {
      const res = await fetch('/api/chat/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chatId: conversationId, chatType: 'dm', muteOption: option }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsMuted(!!data.isMuted);
        setMutedUntil(data.mutedUntil || null);
      }
    } catch (e) {
      console.error('Mute error:', e);
    }
  };

  const handleBlockUser = async () => {
    if (!peerId) return;
    if (!confirm(`Block ${peer?.name || peer?.username || 'this user'}? They will no longer be able to message you.`)) return;
    try {
      await fetch('/api/chat/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ peerId, block: true }),
      });
      router.push('/messages');
    } catch (e) {
      alert('Failed to block user');
    }
  };

  const handleForward = async (target) => {
    if (!forwardMessage) return;
    await sendToTarget(target, { body: forwardMessage.body, mediaUrl: forwardMessage.mediaUrl });
  };

  const loadMore = () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    const oldestId = messages[0]._id;
    fetchMessages(oldestId, true);
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

  const findMessageById = (id) => messages.find(m => m._id === id);

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
    <div className="flex flex-col h-screen font-sans overflow-hidden" style={{ background: theme.pageBg }}>
      <TopNav />
      {/* Header */}
      <div style={{ background: theme.headerBg }} className="backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-sm z-10">
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
            {isPeerOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <h2 className="text-md font-bold text-slate-800 tracking-tight leading-none">
                {peer?.name || peer?.username || 'Teammate'}
              </h2>
              <span className="text-[8px] font-extrabold text-blue-600 bg-blue-50 px-1 py-0.5 rounded tracking-wider uppercase">DM</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-none">
              {typingUsers.length > 0 ? formatTypingText(typingUsers) : peer?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
            title="Chat Settings"
          >
            <SettingsIcon className="w-5 h-5" />
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
      <div className="flex-1 relative min-h-0">
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto p-6 space-y-3"
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
                const isDeleted = msg.deletedForEveryone;
                const prevMsg = idx > 0 ? msgs[idx - 1] : null;
                const nextMsg = idx < msgs.length - 1 ? msgs[idx + 1] : null;
                const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;
                const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;
                const showTime = isLastInGroup ||
                  (nextMsg && (new Date(nextMsg.createdAt) - new Date(msg.createdAt)) > 60000);
                const repliedTo = msg.replyTo ? findMessageById(msg.replyTo) : null;

                const actions = !isDeleted ? [
                  { icon: Reply, label: 'Reply', onClick: () => setReplyToMessage(msg) },
                  { icon: Forward, label: 'Forward', onClick: () => setForwardMessage(msg) },
                  isOwn && { icon: Info, label: 'Message Info', onClick: () => setInfoMessage(msg) },
                  isOwn
                    ? { icon: Trash2, label: 'Delete for Everyone', danger: true, onClick: () => handleDeleteMessage(msg._id, true) }
                    : { icon: Trash2, label: 'Delete for Me', danger: true, onClick: () => handleDeleteMessage(msg._id, false) },
                ].filter(Boolean) : [
                  { icon: Trash2, label: 'Delete for Me', danger: true, onClick: () => handleDeleteMessage(msg._id, false) },
                ];

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
                          style={isDeleted ? undefined : {
                            background: isOwn ? theme.myBubbleBg : theme.peerBubbleBg,
                            color: isOwn ? theme.myBubbleText : theme.peerBubbleText,
                            borderColor: isOwn ? 'transparent' : theme.peerBubbleBorder,
                          }}
                          className={`relative px-4 py-2.5 border ${
                            isFirstInGroup
                              ? (isOwn ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm')
                              : (isOwn ? 'rounded-2xl rounded-tr-md rounded-br-sm' : 'rounded-2xl rounded-tl-md rounded-bl-sm')
                          } shadow-sm ${msg.status === 'failed' ? '!border-rose-300 !bg-rose-50/80 !text-rose-900 shadow-none' : ''} ${
                            isDeleted ? 'bg-slate-100 text-slate-400 italic border-slate-200' : ''
                          } transition-all duration-200 hover:shadow-md`}
                        >
                          {repliedTo && !isDeleted && (
                            <div className="mb-1.5 pl-2 border-l-2 border-white/40 text-[11px] opacity-80 truncate max-w-[220px]">
                              {repliedTo.type === 'image' ? '📷 Photo' : repliedTo.body}
                            </div>
                          )}

                          {msg.type === 'image' && msg.mediaUrl && !isDeleted ? (
                            <MessageImage
                              src={msg.mediaUrl}
                              caption={msg.body && msg.body !== '📷 Photo' ? msg.body : null}
                            />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed select-text">{msg.body}</p>
                          )}

                          {/* Hover Quick Actions */}
                          {!isDeleted && (
                            <div className={`absolute -top-9 ${isOwn ? 'right-2' : 'left-2'} opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1 bg-white border border-slate-100 rounded-lg shadow-md p-0.5 z-20`}>
                              {msg.type === 'image' && msg.mediaUrl ? (
                                <button
                                  onClick={() => copyImage(msg.mediaUrl)}
                                  className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors"
                                  title="Copy Image"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                </button>
                              ) : (
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
                              )}
                              {msg.status === 'failed' && (
                                <button
                                  onClick={() => retryMessage(msg)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                  title="Retry Send"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 stroke-[2]" />
                                </button>
                              )}
                              <MessageActionMenu actions={actions} align={isOwn ? 'right' : 'left'} />
                            </div>
                          )}
                        </div>

                        {showTime && (
                          <div className={`text-[10px] mt-1.5 px-2 text-slate-400 font-medium flex items-center gap-1 ${
                            isOwn ? 'justify-end text-right' : 'justify-start text-left'
                          }`}>
                            <span>{formatMessageTime(msg.createdAt, timeFormat)}</span>
                            {msg.status === 'sending' && (
                              <Loader className="w-2.5 h-2.5 animate-spin text-blue-500" />
                            )}
                            {isOwn && msg.status !== 'sending' && msg.status !== 'failed' && (
                              msg.status === 'read'
                                ? <CheckCheck className="w-2.5 h-2.5 text-blue-500" />
                                : <Check className="w-2.5 h-2.5 text-slate-400" />
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

        <NewMessagesButton count={unseenCount} onClick={() => { scrollToBottom(true); setUnseenCount(0); }} />
      </div>

      {/* Reply Preview Bar */}
      {replyToMessage && (
        <div className="bg-white border-t border-slate-100 px-6 py-2 flex items-center gap-3">
          <div className="w-1 self-stretch bg-blue-500 rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-blue-600">Replying to {replyToMessage.senderId === (user?.id || user?._id) ? 'yourself' : (peer?.name || peer?.username)}</p>
            <p className="text-xs text-slate-500 truncate">{replyToMessage.type === 'image' ? '📷 Photo' : replyToMessage.body}</p>
          </div>
          <button onClick={() => setReplyToMessage(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Composer Input Bar */}
      <div className="bg-white border-t border-slate-100 p-4 shadow-lg z-10">
        <div className="flex items-end gap-3.5 max-w-4xl mx-auto relative">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
          <button
            type="button"
            onClick={handlePickImage}
            disabled={uploadingImage || connectionStatus !== 'accepted'}
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200/80 hover:bg-slate-50 text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            title="Attach Image"
          >
            {uploadingImage ? <Loader className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5 stroke-[1.8]" />}
          </button>

          <textarea
            ref={textareaRef}
            value={messageText}
            onChange={handleTyping}
            onPaste={handlePaste}
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

      <ChatSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Chat Settings"
        profile={{
          avatarLabel: peer?.username?.[0]?.toUpperCase() || '?',
          name: peer?.name || peer?.username || 'Teammate',
          subtitleLines: [peer?.email].filter(Boolean),
        }}
        chatId={`dm-${conversationId}`}
        currentThemeId={theme.id}
        onSelectTheme={handleSelectTheme}
        muteState={{ isMuted, mutedUntil, onSetMute: handleSetMute }}
        extra={<PluginsPanel chatType="dm" chatId={conversationId} />}
        dangerActions={[{ label: 'Block User', icon: ShieldAlert, onClick: handleBlockUser }]}
      />

      <ForwardModal
        open={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        onForward={handleForward}
      />

      {infoMessage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setInfoMessage(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-100 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900">Message Info</h2>
              <button onClick={() => setInfoMessage(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold">Sent</span>
                <span className="text-slate-700 font-medium">{formatMessageTime(infoMessage.createdAt, timeFormat)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold">Status</span>
                <span className={`font-medium flex items-center gap-1 ${infoMessage.status === 'read' ? 'text-blue-600' : 'text-slate-700'}`}>
                  {infoMessage.status === 'read' ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  {infoMessage.status === 'read' ? 'Read' : 'Sent'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatThread;
