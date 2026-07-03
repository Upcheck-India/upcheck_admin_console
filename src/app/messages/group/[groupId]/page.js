'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import TopNav from '../../../components/TopNav';
import ChatSettingsPanel from '../../../components/messages/ChatSettingsPanel';
import MessageActionMenu from '../../../components/messages/MessageActionMenu';
import NewMessagesButton from '../../../components/messages/NewMessagesButton';
import MessageImage from '../../../components/messages/MessageImage';
import ForwardModal from '../../../components/messages/ForwardModal';
import PluginsPanel from '../../../components/messages/PluginsPanel';
import MessageBody from '../../../components/messages/MessageBody';
import TaskMentionDropdown from '../../../components/messages/TaskMentionDropdown';
import TaskInfoModal from '../../../components/messages/TaskInfoModal';
import PluginMessage from '../../../components/messages/PluginMessage';
import { PLUGIN_SENDER_ID } from '../../../utils/pluginSender';
import { useTaskMentionAutocomplete } from '../../../utils/useTaskMentionAutocomplete';
import { useSlashCommandAutocomplete } from '../../../utils/useSlashCommandAutocomplete';
import { useRealtimeChat } from '../../../../hooks/useRealtimeChat';
import SlashCommandDropdown from '../../../components/messages/SlashCommandDropdown';
import { getChatTheme, getChatThemeById, setChatTheme as persistChatTheme } from '../../../utils/chatThemes';
import { useTimeFormat, formatMessageTime } from '../../../utils/timeFormat';
import { formatTypingText } from '../../../utils/typingText';
import { uploadChatImage, getPastedImageFile } from '../../../utils/chatMedia';
import { sendToTarget } from '../../../utils/chatSend';
import {
  ArrowLeft, Send, Loader, Copy, Check, CheckCheck, Users, Trash, AlertCircle,
  Settings as SettingsIcon, ImageIcon, Reply, Forward, Trash2, X, Shield, ShieldOff
} from 'lucide-react';

const POLL_INTERVAL = 4000;
const MESSAGES_LIMIT = 50;

const GroupChatThread = () => {
  const { user } = useAuth(false);
  const router = useRouter();
  const params = useParams();
  const groupId = params?.groupId;
  const timeFormat = useTimeFormat();

  const [messages, setMessages] = useState([]);
  const [group, setGroup] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const lastPollRef = useRef(new Date().toISOString());

  const [theme, setTheme] = useState(getChatThemeById('default'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [mutedUntil, setMutedUntil] = useState(null);

  const isNearBottomRef = useRef(true);
  const [unseenCount, setUnseenCount] = useState(0);

  const [replyToMessage, setReplyToMessage] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [viewingTaskId, setViewingTaskId] = useState(null);
  const taskMention = useTaskMentionAutocomplete({ chatType: 'group', chatId: groupId });
  const slashCommand = useSlashCommandAutocomplete({ chatType: 'group', chatId: groupId });

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
    if (groupId) setTheme(getChatTheme(`group-${groupId}`));
  }, [groupId]);

  const handleSelectTheme = (chatId, themeId) => {
    persistChatTheme(chatId, themeId);
    setTheme(getChatThemeById(themeId));
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [messageText]);

  const fetchGroup = useCallback(async () => {
    try {
      const res = await fetch(`/api/group-chats/${groupId}`, { credentials: 'include' });
      if (!res.ok) {
        setError('Group not found');
        return;
      }
      const data = await res.json();
      setGroup(data.group);
      setParticipants(data.participants || []);
      setCurrentUserIsAdmin(!!data.currentUserIsAdmin);
    } catch (e) {
      console.error(e);
      setError('Failed to load group');
    }
  }, [groupId]);

  const fetchMuteState = useCallback(async () => {
    try {
      const res = await fetch('/api/group-chats', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const g = (data.groupChats || []).find(x => x._id === groupId);
        if (g) {
          setIsMuted(!!g.isMuted);
          setMutedUntil(g.mutedUntil || null);
        }
      }
    } catch (e) {
      // non-critical
    }
  }, [groupId]);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/group-chats/${groupId}/messages?limit=${MESSAGES_LIMIT}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      setMessages(data.messages.reverse());
      lastPollRef.current = new Date().toISOString();
      setTimeout(scrollToBottom, 100);
    } catch (e) {
      console.error('Fetch messages error:', e);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/group-chats/poll?groupId=${groupId}&since=${encodeURIComponent(lastPollRef.current)}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();

      if (data.serverTimestamp) lastPollRef.current = data.serverTimestamp;

      if (data.newMessages?.length > 0) {
        setMessages(prev => {
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

          const myId = user?._id || user?.id;
          const novelFromOthers = novel.filter(m => m.senderId !== myId);
          if (isNearBottomRef.current) {
            setTimeout(() => scrollToBottom(true), 100);
          } else if (novelFromOthers.length > 0) {
            setUnseenCount(c => c + novelFromOthers.length);
          }
          return [...updated, ...novel];
        });
      }

      if (data.typingUsers) setTypingUsers(data.typingUsers);
    } catch (e) {
      console.error('Poll error:', e);
    }
  }, [groupId, user]);

  const applyIncoming = useCallback((msg, isUpdate) => {
    if (!msg || !msg._id) return;
    setMessages(prev => {
      const idx = prev.findIndex(
        m => m._id === msg._id || (msg.clientId && m.clientId && m.clientId === msg.clientId)
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...msg };
        return copy;
      }
      if (isUpdate) return prev;
      const myId = user?._id || user?.id;
      if (isNearBottomRef.current) {
        setTimeout(() => scrollToBottom(true), 100);
      } else if (msg.senderId !== myId) {
        setUnseenCount(c => c + 1);
      }
      return [...prev, msg];
    });
  }, [user]);

  const readTriggerRef = useRef(null);
  const { messagingRealtime, typingRealtime, emitTyping, typingUsers: rtTypingUsers } =
    useRealtimeChat('group', groupId, {
      onMessageNew: (m) => {
        applyIncoming(m, false);
        const myId = user?._id || user?.id;
        if (m.senderId && m.senderId !== myId && !readTriggerRef.current) {
          readTriggerRef.current = setTimeout(() => {
            readTriggerRef.current = null;
            poll();
          }, 400);
        }
      },
      onMessageUpdated: (m) => applyIncoming(m, true),
    });

  useEffect(() => {
    if (typingRealtime) setTypingUsers(rtTypingUsers);
  }, [typingRealtime, rtTypingUsers]);

  useEffect(() => {
    if (!groupId) return;
    fetchGroup();
    fetchMuteState();
    fetchMessages();
  }, [groupId, fetchGroup, fetchMuteState, fetchMessages]);

  useEffect(() => {
    if (messagingRealtime) return;
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [poll, messagingRealtime]);

  const typingTimeoutRef = useRef(null);
  const handleTyping = (e) => {
    setMessageText(e.target.value);
    taskMention.handleComposerChange(e.target.value, e.target.selectionStart);
    slashCommand.handleComposerChange(e.target.value);
    if (e.target.value.trim().length > 0 && !typingTimeoutRef.current) {
      if (typingRealtime) {
        emitTyping();
      } else {
        fetch('/api/group-chats/typing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ groupId })
        }).catch(() => {});
      }
      typingTimeoutRef.current = setTimeout(() => {
        typingTimeoutRef.current = null;
      }, 2000);
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
      alert('Failed to copy image to clipboard');
    }
  };

  const deleteMessage = async (messageId, forEveryone) => {
    if (!confirm(`Delete message for ${forEveryone ? 'everyone' : 'me'}?`)) return;
    try {
      await fetch(`/api/group-chats/${groupId}/messages/${messageId}/delete?forEveryone=${forEveryone}`, {
        method: 'POST',
        credentials: 'include',
      });
      setMessages(prev => {
        if (forEveryone) {
          return prev.map(m => m._id === messageId ? { ...m, body: '[Message deleted]', mediaUrl: undefined } : m);
        }
        return prev.filter(m => m._id !== messageId);
      });
    } catch (e) {
      alert('Failed to delete message');
    }
  };

  const handleToggleAdmin = async (participant) => {
    const action = participant.isAdmin ? 'demote' : 'promote';
    if (!confirm(participant.isAdmin
      ? `Remove admin rights from ${participant.name}?`
      : `Give ${participant.name} admin rights? They'll be able to manage members and settings for this group.`)) return;
    try {
      const res = await fetch(`/api/group-chats/${groupId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: participant.id, action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update admin status');
      }
      await fetchGroup();
    } catch (e) {
      alert(e.message || 'Failed to update admin status');
    }
  };

  const sendMessage = async ({ body, mediaUrl }) => {
    const text = (body || '').trim();
    if (!text && !mediaUrl) return;
    if (sending || !user) return;

    const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage = {
      _id: clientId,
      clientId,
      groupId,
      senderId: user._id || user.id,
      senderName: user.name || user.username,
      body: text || (mediaUrl ? '📷 Photo' : ''),
      type: mediaUrl ? 'image' : 'text',
      mediaUrl,
      status: 'sending',
      createdAt: new Date().toISOString(),
      readBy: [],
      replyToId: replyToMessage?._id || null,
      replyToBody: replyToMessage ? (replyToMessage.type === 'image' ? '📷 Photo' : replyToMessage.body) : null,
      replyToName: replyToMessage?.senderName || null,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setMessageText('');
    setReplyToMessage(null);
    setSending(true);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch(`/api/group-chats/${groupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: text, mediaUrl, replyToId: optimisticMessage.replyToId, clientId })
      });

      if (!res.ok) throw new Error('Failed to send');

      const data = await res.json();
      setMessages(prev => prev.map(m =>
        m._id === clientId ? { ...data.message, clientId, status: 'sent' } : m
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

  const handleSend = () => sendMessage({ body: messageText });

  const handleKeyDown = (e) => {
    if (taskMention.query !== null || slashCommand.query !== null) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePickImage = () => fileInputRef.current?.click();

  const handleImageSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingImage(true);
    try {
      const mediaUrl = await uploadChatImage(file, 'group', groupId);
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
      const mediaUrl = await uploadChatImage(file, 'group', groupId);
      await sendMessage({ body: messageText, mediaUrl });
      setMessageText('');
    } catch (err) {
      alert(err.message || 'Failed to upload pasted image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSetMute = async (option) => {
    try {
      const res = await fetch('/api/chat/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chatId: groupId, chatType: 'group', muteOption: option }),
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

  const handleForward = async (target) => {
    if (!forwardMessage) return;
    await sendToTarget(target, { body: forwardMessage.body, mediaUrl: forwardMessage.mediaUrl });
  };

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-screen">
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

  if (loading && !group) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 h-screen">
        <Loader className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const activeParticipants = participants.filter(p => !p.isExcluded);
  const totalMembers = activeParticipants.length;
  const currentUserId = user?._id || user?.id;

  return (
    <div className="flex flex-col h-screen relative overflow-hidden font-sans" style={{ background: theme.pageBg }}>
      <TopNav />
      <header style={{ background: theme.headerBg }} className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80 shadow-sm z-20">
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={() => router.push('/messages')}
            className="p-2 -ml-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            title="Back to list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-white font-bold shadow-md flex-shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">{group?.name || 'Loading...'}</h2>
            <p className="text-xs text-slate-500 font-medium truncate">
              {typingUsers.length > 0 ? formatTypingText(typingUsers) : `${totalMembers} members`}
            </p>
          </div>
          <button onClick={() => setSettingsOpen(true)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all" title="Group Settings">
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 relative min-h-0">
        <div ref={messagesContainerRef} onScroll={handleScroll} className="h-full overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => {
              if (msg.senderId === PLUGIN_SENDER_ID) {
                return (
                  <PluginMessage
                    key={msg._id}
                    text={msg.body}
                    createdAt={msg.createdAt}
                    timeFormat={timeFormat}
                    onTaskClick={setViewingTaskId}
                    pluginName={msg.pluginName}
                    pluginIcon={msg.pluginIcon}
                  />
                );
              }

              const isMe = msg.senderId === currentUserId;
              const isDeleted = msg.body === '[Message deleted]';
              const readByOthersCount = (msg.readBy || []).filter(r => r.userId !== msg.senderId).length;
              const readByAll = totalMembers > 1 && readByOthersCount >= (totalMembers - 1);

              const actions = !isDeleted ? [
                { icon: Reply, label: 'Reply', onClick: () => setReplyToMessage(msg) },
                { icon: Forward, label: 'Forward', onClick: () => setForwardMessage(msg) },
                { icon: Trash, label: 'Delete for Me', onClick: () => deleteMessage(msg._id, false) },
                isMe && { icon: Trash2, label: 'Delete for Everyone', danger: true, onClick: () => deleteMessage(msg._id, true) },
              ].filter(Boolean) : [
                { icon: Trash, label: 'Delete for Me', onClick: () => deleteMessage(msg._id, false) },
              ];

              return (
                <div key={msg._id} className={`flex w-full group ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xs mr-3 flex-shrink-0 mt-1 shadow-sm">
                      {msg.senderName?.[0]?.toUpperCase()}
                    </div>
                  )}

                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                    {!isMe && (
                      <span className="text-[10px] text-slate-500 font-bold mb-1 ml-1">{msg.senderName}</span>
                    )}
                    <div className="relative group/msg flex items-center gap-2">

                      {isMe && !isDeleted && (
                        <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 bg-white border border-slate-200 rounded-lg shadow-sm p-0.5">
                          {msg.type === 'image' && msg.mediaUrl ? (
                            <button onClick={() => copyImage(msg.mediaUrl)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded" title="Copy image">
                              <ImageIcon className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button onClick={() => copyMessage(msg.body, msg._id)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded" title="Copy text">
                              {copiedMessageId === msg._id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <MessageActionMenu actions={actions} align="right" />
                        </div>
                      )}

                      <div
                        style={isDeleted ? undefined : {
                          background: isMe ? theme.myBubbleBg : theme.peerBubbleBg,
                          color: isMe ? theme.myBubbleText : theme.peerBubbleText,
                          borderColor: isMe ? 'transparent' : theme.peerBubbleBorder,
                        }}
                        className={`relative px-4 py-2.5 rounded-2xl text-sm shadow-sm border ${
                          isDeleted ? 'bg-slate-100 text-slate-400 italic border-slate-200' :
                          isMe ? 'rounded-br-sm' : 'rounded-bl-sm'
                        }`}
                      >
                        {msg.replyToBody && !isDeleted && (
                          <div className="mb-1.5 pl-2 border-l-2 border-white/40 text-[11px] opacity-80 truncate max-w-[220px]">
                            <span className="font-bold">{msg.replyToName}: </span>{msg.replyToBody}
                          </div>
                        )}

                        {msg.type === 'image' && msg.mediaUrl && !isDeleted ? (
                          <MessageImage src={msg.mediaUrl} caption={msg.body && msg.body !== '📷 Photo' ? msg.body : null} />
                        ) : (
                          <div className="whitespace-pre-wrap break-words leading-relaxed font-medium">
                            {isDeleted ? msg.body : (
                              <MessageBody text={msg.body} onTaskClick={setViewingTaskId} />
                            )}
                          </div>
                        )}

                        <div className={`flex items-center justify-end gap-1.5 mt-1 -mb-1 ${isMe ? '' : 'text-slate-400'}`} style={isMe ? { color: theme.myBubbleText, opacity: 0.75 } : undefined}>
                          <span className="text-[9px] font-semibold tracking-wide">
                            {formatMessageTime(msg.createdAt, timeFormat)}
                          </span>
                          {isMe && msg.status === 'sending' && <Loader className="w-3 h-3 animate-spin" />}
                          {isMe && msg.status !== 'sending' && (
                            readByAll
                              ? <CheckCheck className="w-3 h-3 text-blue-300" />
                              : <CheckCheck className="w-3 h-3 opacity-60" />
                          )}
                        </div>
                      </div>

                      {!isMe && (
                        <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 bg-white border border-slate-200 rounded-lg shadow-sm p-0.5">
                          {msg.type === 'image' && msg.mediaUrl ? (
                            <button onClick={() => copyImage(msg.mediaUrl)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded">
                              <ImageIcon className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button onClick={() => copyMessage(msg.body, msg._id)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded">
                              {copiedMessageId === msg._id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <MessageActionMenu actions={actions} align="left" />
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

        <NewMessagesButton count={unseenCount} onClick={() => { scrollToBottom(true); setUnseenCount(0); }} />
      </div>

      {replyToMessage && (
        <div className="bg-white border-t border-slate-100 px-4 py-2 flex items-center gap-3 max-w-3xl mx-auto w-full">
          <div className="w-1 self-stretch bg-blue-500 rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-blue-600">Replying to {replyToMessage.senderName}</p>
            <p className="text-xs text-slate-500 truncate">{replyToMessage.type === 'image' ? '📷 Photo' : replyToMessage.body}</p>
          </div>
          <button onClick={() => setReplyToMessage(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white border-t border-slate-200/80 px-4 py-4 z-20">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
          <button
            type="button"
            onClick={handlePickImage}
            disabled={uploadingImage}
            className="w-11 h-11 flex items-center justify-center rounded-2xl border border-slate-200/80 hover:bg-slate-50 text-slate-500 disabled:opacity-50 transition-all flex-shrink-0"
            title="Attach Image"
          >
            {uploadingImage ? <Loader className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
          </button>
          <div className="flex-1 bg-slate-50 border border-slate-200/80 rounded-2xl relative shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
            {taskMention.query !== null && (
              <TaskMentionDropdown
                loading={taskMention.loading}
                tasks={taskMention.results}
                onSelect={(task) => setMessageText(prev => taskMention.selectTask(task, prev))}
              />
            )}
            {slashCommand.query !== null && (
              <SlashCommandDropdown
                loading={slashCommand.loading}
                commands={slashCommand.results}
                onSelect={(cmd) => { setMessageText(`/${cmd.name} `); slashCommand.close(); }}
              />
            )}
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={handleTyping}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Type a message... (Use **bold**, *italic*, `code`, @mention, #task)"
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

      <ChatSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Group Chat Settings"
        profile={{
          avatarLabel: group?.name?.[0]?.toUpperCase() || 'G',
          name: group?.name || 'Group',
          subtitleLines: [group?.description, `${totalMembers} members`].filter(Boolean),
        }}
        chatId={`group-${groupId}`}
        currentThemeId={theme.id}
        onSelectTheme={handleSelectTheme}
        muteState={{ isMuted, mutedUntil, onSetMute: handleSetMute }}
        extra={
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Members ({totalMembers})</h3>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {activeParticipants.map(p => (
                <div key={p.id} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[10px] flex-shrink-0">
                    {p.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-slate-700 truncate flex-1">{p.name}</span>
                  {p.isAdmin && (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      <Shield className="w-2.5 h-2.5" /> Admin
                    </span>
                  )}
                  {currentUserIsAdmin && p.id !== (user?._id || user?.id) && (
                    <button
                      type="button"
                      onClick={() => handleToggleAdmin(p)}
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                      title={p.isAdmin ? 'Remove admin' : 'Make admin'}
                    >
                      {p.isAdmin ? <ShieldOff className="w-3.5 h-3.5 text-orange-500" /> : <Shield className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-slate-100">
              <PluginsPanel chatType="group" chatId={groupId} />
            </div>
          </div>
        }
      />

      <ForwardModal
        open={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        onForward={handleForward}
      />

      <TaskInfoModal taskId={viewingTaskId} onClose={() => setViewingTaskId(null)} />
    </div>
  );
};

export default GroupChatThread;
