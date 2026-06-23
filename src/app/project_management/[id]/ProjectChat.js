'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, Bold, Italic, Underline, Trash2, Edit2, Pin, PinOff, 
  AlertTriangle, Loader2, MessageSquare, Bell, X, 
  Check, ChevronDown, Highlighter, Palette, Code, Quote, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import AvatarWithStatus from '../../../components/AvatarWithStatus';

// Formatting utilities and HTML escape to prevent XSS
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseFormatting(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // Parse code blocks (```code```)
  // Must run before inline code to avoid conflicts
  html = html.replace(/```([\s\S]*?)```/g, (_match, code) => {
    return `<pre style="background:#1e293b;color:#2dd4bf;font-family:monospace;padding:10px 12px;border-radius:8px;font-size:11px;overflow-x:auto;margin:6px 0;border:1px solid #334155">${code.trim()}</pre>`;
  });

  // Parse inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.12);color:#f87171;font-family:monospace;padding:1px 5px;border-radius:4px;font-size:11px;border:1px solid rgba(0,0,0,0.1)">$1</code>');

  // Parse bold (**text**) - inherit color so it works on both white and blue bubbles
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:700">$1</strong>');

  // Parse italic (*text*)
  html = html.replace(/\*([^*]+)\*/g, '<em style="font-style:italic">$1</em>');

  // Parse underline (__text__)
  html = html.replace(/__([^_]+)__/g, '<u style="text-decoration:underline;text-decoration-color:rgba(99,102,241,0.7)">$1</u>');

  // Parse strikethrough (~~text~~)
  html = html.replace(/~~([^~]+)~~/g, '<s style="opacity:0.6">$1</s>');

  // Parse highlight (==text==) - explicit dark text so it\'s always readable
  html = html.replace(/==([^=]+)==/g, '<mark style="background:#fef08a;color:#713f12;padding:1px 4px;border-radius:3px;font-weight:600">$1</mark>');

  // Parse color ([color=hex]text[/color])
  html = html.replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/g, '<span style="color:$1">$2</span>');

  // Parse blockquotes (> text) — after escaping, > becomes &gt;
  html = html.replace(/(?:^|\n)&gt;\s*([^\n]+)/g, '<div style="border-left:3px solid #14b8a6;background:rgba(20,184,166,0.08);padding:4px 10px;margin:4px 0;border-radius:0 6px 6px 0;font-style:italic;opacity:0.9">$1</div>');

  // ── Mention & reference badges ──────────────────────────────────────────────
  // All badges use inline styles so they are atomic color blocks regardless of
  // the parent bubble background (white or blue).

  // 1. @notify — must be matched before generic @username
  html = html.replace(/@notify/g,
    '<span style="display:inline-flex;align-items:center;gap:3px;background:#fef2f2;color:#b91c1c;padding:1px 8px;border-radius:9999px;font-weight:700;font-size:11px;border:1px solid #fca5a5;vertical-align:middle">🔔 @notify</span>'
  );

  // 2. Generic @username (after @notify is already replaced)
  html = html.replace(/@([a-zA-Z0-9_.:-]+)/g, (_m, username) => {
    return `<span style="display:inline-flex;align-items:center;background:#eff6ff;color:#1d4ed8;padding:1px 7px;border-radius:5px;font-weight:600;font-size:11px;border:1px solid #bfdbfe;vertical-align:middle">@${username}</span>`;
  });

  // 3. Role @[Role Name]
  html = html.replace(/@\[([^\]]+)\]/g,
    '<span style="display:inline-flex;align-items:center;background:#eef2ff;color:#4338ca;padding:1px 7px;border-radius:5px;font-weight:600;font-size:11px;border:1px solid #c7d2fe;vertical-align:middle">💼\u00a0$1</span>'
  );

  // 4. Team @{Team Name}
  html = html.replace(/@\{([^}]+)\}/g,
    '<span style="display:inline-flex;align-items:center;background:#ecfdf5;color:#065f46;padding:1px 7px;border-radius:5px;font-weight:600;font-size:11px;border:1px solid #6ee7b7;vertical-align:middle">👥\u00a0$1</span>'
  );

  // 5. Task #[Task Title]
  html = html.replace(/#\[([^\]]+)\]/g,
    '<span style="display:inline-flex;align-items:center;background:#fffbeb;color:#92400e;padding:1px 7px;border-radius:5px;font-weight:600;font-size:11px;border:1px solid #fcd34d;vertical-align:middle">#\u00a0$1</span>'
  );

  // 6. GitHub branch [branch:name]
  html = html.replace(/\[branch:([^\]]+)\]/g,
    '<span style="display:inline-flex;align-items:center;background:#f0f9ff;color:#0c4a6e;padding:1px 7px;border-radius:5px;font-weight:600;font-size:11px;border:1px solid #7dd3fc;vertical-align:middle">🌿\u00a0$1</span>'
  );

  // 7. GitHub commit [commit:sha]
  html = html.replace(/\[commit:([^\]]+)\]/g,
    '<span style="display:inline-flex;align-items:center;background:#f5f3ff;color:#5b21b6;padding:1px 7px;border-radius:5px;font-weight:600;font-size:11px;border:1px solid #c4b5fd;vertical-align:middle">💾\u00a0$1</span>'
  );

  // 8. GitHub PR [pr:number]
  html = html.replace(/\[pr:([^\]]+)\]/g,
    '<span style="display:inline-flex;align-items:center;background:#faf5ff;color:#6d28d9;padding:1px 7px;border-radius:5px;font-weight:600;font-size:11px;border:1px solid #d8b4fe;vertical-align:middle">🔀\u00a0PR #$1</span>'
  );

  // 9. GitHub contributor [github-contributor:username]
  html = html.replace(/\[github-contributor:([^\]]+)\]/g,
    '<span style="display:inline-flex;align-items:center;background:#f8fafc;color:#334155;padding:1px 7px;border-radius:5px;font-weight:600;font-size:11px;border:1px solid #cbd5e1;vertical-align:middle">🐱\u00a0@$1</span>'
  );

  return html;
}

// ── Input Preview: converts raw tokens to colored badge HTML for the mirror overlay ──
function parseInputPreview(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // @notify — must come before generic @username
  html = html.replace(
    /@notify/g,
    '<mark style="display:inline;background:#fef2f2;color:#b91c1c;padding:1px 8px;border-radius:9999px;font-weight:700;border:1px solid #fca5a5;white-space:nowrap">\uD83D\uDD14\u00a0@notify</mark>'
  );
  // @[Role]
  html = html.replace(
    /@\[([^\]]+)\]/g,
    '<mark style="display:inline;background:#eef2ff;color:#4338ca;padding:1px 7px;border-radius:5px;font-weight:600;border:1px solid #c7d2fe;white-space:nowrap">\uD83D\uDCBC\u00a0$1</mark>'
  );
  // @{Team}
  html = html.replace(
    /@\{([^}]+)\}/g,
    '<mark style="display:inline;background:#ecfdf5;color:#065f46;padding:1px 7px;border-radius:5px;font-weight:600;border:1px solid #6ee7b7;white-space:nowrap">\uD83D\uDC65\u00a0$1</mark>'
  );
  // Generic @username
  html = html.replace(/@([a-zA-Z0-9_.:-]+)/g, (_m, u) =>
    `<mark style="display:inline;background:#eff6ff;color:#1d4ed8;padding:1px 7px;border-radius:5px;font-weight:600;border:1px solid #bfdbfe;white-space:nowrap">@${u}</mark>`
  );
  // #[Task Title]
  html = html.replace(
    /#\[([^\]]+)\]/g,
    '<mark style="display:inline;background:#fffbeb;color:#92400e;padding:1px 7px;border-radius:5px;font-weight:600;border:1px solid #fcd34d;white-space:nowrap">#\u00a0$1</mark>'
  );
  // [branch:name]
  html = html.replace(
    /\[branch:([^\]]+)\]/g,
    '<mark style="display:inline;background:#f0f9ff;color:#0c4a6e;padding:1px 7px;border-radius:5px;font-weight:600;border:1px solid #7dd3fc;white-space:nowrap">\uD83C\uDF3F\u00a0$1</mark>'
  );
  // [commit:sha]
  html = html.replace(
    /\[commit:([^\]]+)\]/g,
    '<mark style="display:inline;background:#f5f3ff;color:#5b21b6;padding:1px 7px;border-radius:5px;font-weight:600;border:1px solid #c4b5fd;white-space:nowrap">\uD83D\uDCBE\u00a0$1</mark>'
  );
  // [pr:number]
  html = html.replace(
    /\[pr:([^\]]+)\]/g,
    '<mark style="display:inline;background:#faf5ff;color:#6d28d9;padding:1px 7px;border-radius:5px;font-weight:600;border:1px solid #d8b4fe;white-space:nowrap">\uD83D\uDD00\u00a0PR\u00a0#$1</mark>'
  );
  // [github-contributor:username]
  html = html.replace(
    /\[github-contributor:([^\]]+)\]/g,
    '<mark style="display:inline;background:#f8fafc;color:#334155;padding:1px 7px;border-radius:5px;font-weight:600;border:1px solid #cbd5e1;white-space:nowrap">\uD83D\uDC31\u00a0@$1</mark>'
  );
  // Preserve newlines
  html = html.replace(/\n/g, '<br>');
  return html + '<br>'; // trailing br prevents container collapse
}

export default function ProjectChat({ projectId, project, allUsers = [], allTeams = [], isSidebar = false }) {
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const mirrorRef = useRef(null); // mirror div for rich-input preview

  // States
  const [messages, setMessages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pinnedFilter, setPinnedFilter] = useState(false); // Filter messages to show pinned only (wide view)
  const [apiWarnings, setApiWarnings] = useState([]);

  // GitHub mentions states
  const [gitBranches, setGitBranches] = useState([]);
  const [gitCommits, setGitCommits] = useState([]);
  const [gitPulls, setGitPulls] = useState([]);
  const [gitContributors, setGitContributors] = useState([]);

  // Modals & Action States
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, body, senderName }

  // @notify modal: ask whom to notify before sending
  const [notifyModal, setNotifyModal] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState('everyone'); // 'everyone' | 'team' | 'members'
  const [notifySelectedTeam, setNotifySelectedTeam] = useState('');
  const [notifySelectedMembers, setNotifySelectedMembers] = useState([]);

  // Mentions Autocomplete state
  const [mentionType, setMentionType] = useState(null); // '@' | '#'
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 });
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);

  // Register active chat component in window so GlobalChatWrapper suppresses toasts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__activeProjectChatId = projectId;
    }
    return () => {
      if (typeof window !== 'undefined') {
        if (window.__activeProjectChatId === projectId) {
          window.__activeProjectChatId = null;
        }
      }
    };
  }, [projectId]);

  // Fetch project tasks for mention lists
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/tasks`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setTasks(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to fetch tasks for mentions:', err);
      }
    };
    if (projectId) fetchTasks();
  }, [projectId]);

  // Fetch GitHub info for mentions
  useEffect(() => {
    if (!projectId) return;
    
    const fetchGithubData = async () => {
      try {
        const endpoints = ['branches', 'commits', 'pulls', 'contributors'];
        const results = await Promise.allSettled(
          endpoints.map(ep => 
            fetch(`/api/projects/${projectId}/github?endpoint=${ep}`, { credentials: 'include' })
              .then(res => res.ok ? res.json() : null)
          )
        );

        if (results[0].status === 'fulfilled' && results[0].value) {
          setGitBranches(results[0].value.data || []);
        }
        if (results[1].status === 'fulfilled' && results[1].value) {
          setGitCommits(results[1].value.data || []);
        }
        if (results[2].status === 'fulfilled' && results[2].value) {
          setGitPulls(results[2].value.data || []);
        }
        if (results[3].status === 'fulfilled' && results[3].value) {
          setGitContributors(results[3].value.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch github mentions data:', err);
      }
    };

    fetchGithubData();
  }, [projectId]);

  // Poll Chat Messages
  const fetchChatMessages = async (isInitial = false) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setIsManager(data.isManager === true);
      }
    } catch (err) {
      console.error('Failed to load project chat:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    fetchChatMessages(true);

    const msgInterval = setInterval(() => fetchChatMessages(false), 3000);
    return () => clearInterval(msgInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Typing indicators polling
  const fetchTypingUsers = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chat/typing`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTypingUsers(data.typingUsers || []);
      }
    } catch (err) {
      console.error('Failed to load typing users:', err);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    fetchTypingUsers();
    const typingInterval = setInterval(fetchTypingUsers, 3000);
    return () => clearInterval(typingInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Handle typing indicator post
  const lastTypingSentRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);
    handleMentionsSearch(val, e.target.selectionStart);

    // Typing API
    if (!lastTypingSentRef.current && val.trim().length > 0) {
      lastTypingSentRef.current = true;
      postTypingStatus(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      lastTypingSentRef.current = false;
      postTypingStatus(false);
    }, 4000);
  };

  const postTypingStatus = async (isTyping) => {
    try {
      await fetch(`/api/projects/${projectId}/chat/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTyping }),
        credentials: 'include'
      });
    } catch (e) {
      // Ignore
    }
  };

  // Autoscroll to bottom
  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  useEffect(() => {
    if (!loading) {
      scrollToBottom('auto');
    }
  }, [messages.length, loading]);

  // Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    lastTypingSentRef.current = false;
    postTypingStatus(false);

    const clientMsgId = Math.random().toString(36).substring(2, 9);
    const originalText = inputText;
    setInputText('');
    setShowMentionSuggestions(false);
    setApiWarnings([]);

    // Optimistic UI insert
    const tempMsg = {
      id: clientMsgId,
      body: originalText,
      createdAt: new Date().toISOString(),
      sender: {
        userId: user?._id || user?.id,
        username: user?.username || 'me',
        name: user?.name || user?.username || 'Me',
        role: user?.role || 'Member'
      },
      pinned: false,
      isOptimistic: true
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageText: originalText, clientId: clientMsgId }),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.warnings && data.warnings.length > 0) {
          setApiWarnings(data.warnings);
        }
        fetchChatMessages(false);
      } else {
        throw new Error('Send failed');
      }
    } catch (err) {
      console.error(err);
      // Remove optimistic msg and restore text
      setMessages(prev => prev.filter(m => m.id !== clientMsgId));
      setInputText(originalText);
    }
  };

  // Toggle Pinned status
  const handleTogglePin = async (msgId, currentPinned) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msgId, pinToggle: !currentPinned }),
        credentials: 'include'
      });
      if (res.ok) {
        fetchChatMessages(false);
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  // Save Edit
  const handleSaveEdit = async (msgId) => {
    if (!editText.trim()) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msgId, newContent: editText }),
        credentials: 'include'
      });
      if (res.ok) {
        setEditingMessageId(null);
        setEditText('');
        fetchChatMessages(false);
      }
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  // Delete message
  const handleDeleteMessage = async (msgId, action) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msgId, action }),
        credentials: 'include'
      });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchChatMessages(false);
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  // Text formatting insertion
  const insertFormatting = (syntaxStart, syntaxEnd = '') => {
    if (!inputRef.current) return;
    const textarea = inputRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const selectedText = text.substring(start, end);
    const newText = text.substring(0, start) + syntaxStart + selectedText + syntaxEnd + text.substring(end);
    
    setInputText(newText);
    textarea.focus();
    
    // Position cursor after the tags
    setTimeout(() => {
      textarea.selectionStart = start + syntaxStart.length;
      textarea.selectionEnd = start + syntaxStart.length + selectedText.length;
    }, 50);
  };

  // Mention system autocompletion search
  const handleMentionsSearch = (text, cursorPosition) => {
    const beforeCursor = text.substring(0, cursorPosition);
    const lastAt = beforeCursor.lastIndexOf('@');
    const lastHash = beforeCursor.lastIndexOf('#');

    const handleMatch = (index, char) => {
      const queryStr = beforeCursor.substring(index + 1);
      if (!/\s/.test(queryStr)) {
        setMentionType(char);
        setMentionQuery(queryStr);
        setMentionPosition({ start: index, end: cursorPosition });
        setShowMentionSuggestions(true);
        return true;
      }
      return false;
    };

    if (lastAt >= 0 && (lastHash < 0 || lastAt > lastHash)) {
      if (handleMatch(lastAt, '@')) return;
    }

    if (lastHash >= 0 && (lastAt < 0 || lastHash > lastAt)) {
      if (handleMatch(lastHash, '#')) return;
    }

    setShowMentionSuggestions(false);
  };

  // Autocomplete data computation
  const mentionSuggestions = useMemo(() => {
    if (!showMentionSuggestions) return [];
    const query = mentionQuery.toLowerCase();

    if (mentionType === '@') {
      const suggestions = [];

      // Special "@notify" option
      if ('notify'.startsWith(query)) {
        suggestions.push({
          type: 'special',
          value: 'notify',
          display: '🔔 notify (email alert)',
          insert: 'notify '
        });
      }

      // 1. Teammates
      const members = new Set();
      if (project?.superManager) members.add(project.superManager);
      project?.members?.forEach(m => {
        if (m.user) members.add(m.user);
        if (m.username) members.add(m.username);
      });

      allUsers.forEach(u => {
        if (members.has(u.username) && u.username.toLowerCase().includes(query)) {
          suggestions.push({
            type: 'user',
            value: u.username,
            display: `@${u.username} (${u.name || u.username})`,
            insert: `${u.username} `
          });
        }
      });

      // 2. Roles
      const roles = ['Project Manager', 'Developer', 'Designer', 'Tester', 'QA Engineer', 'Product Owner'];
      roles.forEach(role => {
        if (role.toLowerCase().includes(query)) {
          suggestions.push({
            type: 'role',
            value: role,
            display: `💼 Role: ${role}`,
            insert: `[${role}] `
          });
        }
      });

      // 3. Teams
      allTeams.forEach(team => {
        const teamName = team.name || '';
        if (teamName.toLowerCase().includes(query)) {
          suggestions.push({
            type: 'team',
            value: teamName,
            display: `👥 Team: ${teamName}`,
            insert: `{${teamName}} `
          });
        }
      });

      // 4. GitHub Contributors
      gitContributors.forEach(c => {
        if (c.login && c.login.toLowerCase().includes(query)) {
          suggestions.push({
            type: 'github-contributor',
            value: c.login,
            display: `🐱 Git Contributor: @${c.login}`,
            insert: `[github-contributor:${c.login}] `
          });
        }
      });

      return suggestions.slice(0, 8);
    }

    if (mentionType === '#') {
      const suggestions = [];

      // 1. Tasks
      tasks.forEach(t => {
        if (t.title && t.title.toLowerCase().includes(query)) {
          suggestions.push({
            type: 'task',
            value: t._id,
            display: `# ${t.title}`,
            insert: `[${t.title}] `
          });
        }
      });

      // 2. GitHub Branches
      gitBranches.forEach(b => {
        if (b.name && b.name.toLowerCase().includes(query)) {
          suggestions.push({
            type: 'github-branch',
            value: b.name,
            display: `🌿 Git Branch: ${b.name}`,
            insert: `[branch:${b.name}] `
          });
        }
      });

      // 3. GitHub Commits
      gitCommits.forEach(c => {
        const shortSha = c.sha?.substring(0, 7) || '';
        const msg = c.commit?.message?.split('\n')[0] || '';
        if (shortSha.toLowerCase().includes(query) || msg.toLowerCase().includes(query)) {
          suggestions.push({
            type: 'github-commit',
            value: c.sha,
            display: `💾 Git Commit: ${shortSha} - ${msg.substring(0, 25)}...`,
            insert: `[commit:${shortSha}] `
          });
        }
      });

      // 4. GitHub PRs
      gitPulls.forEach(p => {
        const title = p.title || '';
        const number = p.number?.toString() || '';
        if (title.toLowerCase().includes(query) || number.includes(query)) {
          suggestions.push({
            type: 'github-pr',
            value: number,
            display: `🔀 Git PR #${number}: ${title.substring(0, 25)}...`,
            insert: `[pr:${number}] `
          });
        }
      });

      return suggestions.slice(0, 8);
    }

    return [];
  }, [showMentionSuggestions, mentionType, mentionQuery, project, allUsers, allTeams, tasks, gitContributors, gitBranches, gitCommits, gitPulls]);

  const selectSuggestion = (suggestion) => {
    const text = inputText;
    const startPos = mentionPosition.start;
    const endPos = mentionPosition.end;

    const insertedText = mentionType + suggestion.insert;
    const newText = text.substring(0, startPos) + insertedText + text.substring(endPos);

    setInputText(newText);
    setShowMentionSuggestions(false);
    setMentionIndex(0);
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const cursor = startPos + insertedText.length;
        inputRef.current.setSelectionRange(cursor, cursor);
      }
    }, 50);
  };

  const handleKeyDown = (e) => {
    if (showMentionSuggestions && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % mentionSuggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectSuggestion(mentionSuggestions[mentionIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionSuggestions(false);
      }
    }
  };

  const isNotifyMentionActive = inputText.includes('@notify');

  // Collect project members for notify modal
  const projectMembers = useMemo(() => {
    const memberIds = new Set();
    if (project?.superManager) memberIds.add(project.superManager);
    project?.members?.forEach(m => {
      if (m.user) memberIds.add(m.user);
      if (m.username) memberIds.add(m.username);
    });
    return allUsers.filter(u => memberIds.has(u.username) || memberIds.has(u._id?.toString()));
  }, [project, allUsers]);

  const filteredMessages = useMemo(() => {
    if (pinnedFilter) {
      return messages.filter(m => m.pinned === true);
    }
    return messages;
  }, [messages, pinnedFilter]);

  const groupedMessages = useMemo(() => {
    const groups = [];
    let lastDateStr = '';

    filteredMessages.forEach(msg => {
      const date = new Date(msg.createdAt);
      let dateStr = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
      const todayStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      if (dateStr === todayStr) dateStr = 'Today';
      else if (dateStr === yesterdayStr) dateStr = 'Yesterday';

      if (dateStr !== lastDateStr) {
        groups.push({ type: 'date', label: dateStr });
        lastDateStr = dateStr;
      }
      groups.push({ type: 'message', message: msg });
    });

    return groups;
  }, [filteredMessages]);

  return (
    <div className={`flex flex-col bg-slate-50 border border-gray-200 rounded-2xl overflow-hidden transition-all duration-300 ${
      isSidebar ? 'h-full max-h-[85vh] w-full shadow-lg' : 'h-[calc(100vh-320px)] min-h-[550px] shadow-sm'
    }`}>
      
      {/* Top Warnings */}
      {apiWarnings.length > 0 && (
        <div className="bg-red-50 border-b border-red-150 p-2.5 px-4 flex items-center justify-between text-xs text-red-800 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <div className="flex flex-col">
              {apiWarnings.map((warn, i) => (
                <span key={i} className="font-medium">{warn}</span>
              ))}
            </div>
          </div>
          <button onClick={() => setApiWarnings([])} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-150 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-500 flex items-center justify-center text-white shadow-sm">
            <MessageSquare className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm md:text-base leading-tight">Project Hub Chat</h3>
            <p className="text-[10px] text-gray-500">Collaborate with your teammates on tasks & sprints</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isSidebar && (
            <button
              onClick={() => setPinnedFilter(prev => !prev)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all duration-200 flex items-center gap-1.5 ${
                pinnedFilter 
                  ? 'bg-amber-50 text-amber-700 border-amber-200' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Pin className="h-3.5 w-3.5" />
              <span>Pinned Only</span>
            </button>
          )}

          <button
            onClick={() => fetchChatMessages(false)}
            className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
            title="Refresh Feed"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 bg-gray-50/50">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 py-10">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            <span className="text-xs">Loading conversations...</span>
          </div>
        ) : groupedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-400 my-auto">
            <MessageSquare className="h-10 w-10 text-gray-300 mb-2.5" />
            <p className="text-sm font-semibold text-gray-600">No messages in this chat yet</p>
            <p className="text-xs max-w-xs mt-1">Start the conversation! Type a message below and use @mentions or formatting toolbar.</p>
          </div>
        ) : (
          groupedMessages.map((item, idx) => {
            if (item.type === 'date') {
              return (
                <div key={`date-${idx}`} className="flex items-center justify-center my-4">
                  <span className="bg-gray-200/70 text-gray-600 font-semibold px-3 py-1 rounded-full text-[10px] tracking-wider uppercase shadow-sm border border-gray-300/30">
                    {item.label}
                  </span>
                </div>
              );
            }

            const msg = item.message;
            const isMine = msg.sender?.userId === (user?._id || user?.id);
            const isEdited = msg.editedAt ? true : false;

            return (
              <div 
                key={msg.id} 
                className={`flex gap-3 animate-in fade-in duration-300 ${
                  isMine ? 'justify-end' : 'justify-start'
                } group`}
              >
                {!isMine && (
                  <div className="flex-shrink-0 self-end mb-1">
                    <AvatarWithStatus
                      username={msg.sender?.username}
                      online={false}
                      className="h-8 w-8 text-xs border border-gray-200 shadow-xs"
                    />
                  </div>
                )}

                <div className="max-w-[78%] flex flex-col">
                  <div className={`flex items-center gap-1.5 mb-1 px-1 text-[10px] text-gray-400 ${
                    isMine ? 'justify-end' : 'justify-start'
                  }`}>
                    <span className="font-semibold text-gray-600">
                      {isMine ? 'You' : msg.sender?.name || msg.sender?.username}
                    </span>
                    <span className="bg-gray-100 text-gray-500 px-1 py-0.2 rounded scale-90">
                      {msg.sender?.role || 'Member'}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isEdited && <span className="italic">(edited)</span>}
                  </div>

                  <div className="relative">
                    {editingMessageId === msg.id ? (
                      <div className="bg-white p-2.5 rounded-xl border border-blue-500 shadow-lg flex flex-col gap-2 w-72 md:w-96">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full text-sm border-transparent focus:ring-0 focus:border-transparent outline-none resize-none min-h-[60px]"
                          placeholder="Edit your message..."
                        />
                        <div className="flex justify-end gap-1.5 border-t pt-2 border-gray-150">
                          <button
                            onClick={() => {
                              setEditingMessageId(null);
                              setEditText('');
                            }}
                            className="px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(msg.id)}
                            className="px-2 py-1 text-[10px] bg-blue-600 text-white hover:bg-blue-700 rounded font-semibold"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={`relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs ${
                        msg.isOptimistic 
                          ? 'bg-blue-300 text-white rounded-br-sm' 
                          : msg.pinned
                          ? 'bg-amber-50 text-gray-800 border-2 border-amber-300 rounded-lg shadow-sm'
                          : isMine 
                          ? 'bg-blue-600 text-white rounded-br-sm' 
                          : 'bg-white border border-gray-150 text-gray-800 rounded-bl-sm shadow-2xs'
                      }`}>
                        
                        {msg.pinned && (
                          <div className="flex items-center gap-1 text-[9px] text-amber-700 uppercase font-bold tracking-wider mb-1.5 border-b border-amber-200 pb-0.5">
                            <Pin className="h-2.5 w-2.5 fill-amber-700" />
                            <span>Pinned by @{msg.pinnedBy || 'manager'}</span>
                          </div>
                        )}

                        {/* Message body — dangerouslySetInnerHTML is safe here because
                            content is HTML-escaped first in parseFormatting via escapeHtml()
                            and only controlled HTML tags are re-injected by parseFormatting. */}
                        <div
                          dangerouslySetInnerHTML={{ __html: parseFormatting(msg.body) }}
                          className="break-words max-w-full overflow-hidden [&_strong]:font-bold [&_em]:italic [&_u]:underline"
                        />
                      </div>
                    )}

                    {!msg.isOptimistic && editingMessageId !== msg.id && !msg.isDeletedForEveryone && (
                      <div className={`absolute top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm z-10 ${
                        isMine ? 'left-0 -translate-x-[110%]' : 'right-0 translate-x-[110%]'
                      }`}>
                        {isManager && (
                          <button
                            onClick={() => handleTogglePin(msg.id, msg.pinned)}
                            className={`p-1 rounded-md transition-colors ${
                              msg.pinned 
                                ? 'text-amber-500 hover:bg-amber-50' 
                                : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100'
                            }`}
                            title={msg.pinned ? 'Unpin message' : 'Pin message'}
                          >
                            {msg.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                          </button>
                        )}

                        {isMine && (
                          <button
                            onClick={() => {
                              setEditingMessageId(msg.id);
                              setEditText(msg.body);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-md transition-colors"
                            title="Edit message"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setDeleteConfirm({ id: msg.id, body: msg.body, senderName: msg.sender?.name || msg.sender?.username, isMine });
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-md transition-colors"
                          title="Delete message"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator row */}
      {typingUsers.length > 0 && (
        <div className="bg-gray-50/80 border-t border-gray-150 px-5 py-1.5 flex items-center gap-2">
          <div className="flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]"></span>
          </div>
          <span className="text-[10px] text-gray-500 italic">
            {typingUsers.map(u => `@${u.username}`).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </span>
        </div>
      )}

      {/* Message Compose Form & Toolbar */}
      <div className="bg-white border-t border-gray-150 p-3.5 relative">
        {showMentionSuggestions && mentionSuggestions.length > 0 && (
          <div className="absolute left-4 bottom-full mb-2 bg-white rounded-xl shadow-2xl border border-gray-200 py-1.5 max-h-56 overflow-y-auto w-64 md:w-72 z-[100]">
            <div className="px-3 py-1 border-b border-gray-100 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              {mentionType === '@' ? 'Mention Teammates, Roles, Teams' : 'Reference Tasks'}
            </div>
            {mentionSuggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectSuggestion(s)}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between ${
                  idx === mentionIndex 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{s.display}</span>
                {idx === mentionIndex && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="space-y-2">
          {/* Rich Editor Toolbar */}
          <div className="flex flex-wrap items-center gap-1 pb-1.5 border-b border-gray-100">
            <button
              type="button"
              onClick={() => insertFormatting('**', '**')}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
              title="Bold (**text**)"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            
            <button
              type="button"
              onClick={() => insertFormatting('*', '*')}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
              title="Italic (*text*)"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            
            <button
              type="button"
              onClick={() => insertFormatting('__', '__')}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
              title="Underline (__text__)"
            >
              <Underline className="h-3.5 w-3.5" />
            </button>
            
            <button
              type="button"
              onClick={() => insertFormatting('~~', '~~')}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
              title="Strikethrough (~~text~~)"
            >
              <span className="h-3.5 w-3.5 border-t border-gray-500 block relative top-0.5 -mt-0.5 select-none font-bold text-[8px] leading-[8px] text-gray-500">ABC</span>
            </button>

            <button
              type="button"
              onClick={() => insertFormatting('==', '==')}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
              title="Highlight (==text==)"
            >
              <Highlighter className="h-3.5 w-3.5" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPicker(prev => !prev)}
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors flex items-center gap-0.5"
                title="Color text"
              >
                <Palette className="h-3.5 w-3.5" />
                <ChevronDown className="h-2.5 w-2.5" />
              </button>

              {showColorPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />
                  <div className="absolute left-0 bottom-full mb-1.5 bg-white p-2 rounded-lg shadow-xl border border-gray-200 z-50 flex gap-1.5">
                    {[
                      { hex: '#ef4444', label: 'Red' },
                      { hex: '#3b82f6', label: 'Blue' },
                      { hex: '#10b981', label: 'Green' },
                      { hex: '#f59e0b', label: 'Yellow' },
                      { hex: '#8b5cf6', label: 'Purple' }
                    ].map(col => (
                      <button
                        key={col.hex}
                        type="button"
                        onClick={() => {
                          insertFormatting(`[color=${col.hex}]`, '[/color]');
                          setShowColorPicker(false);
                        }}
                        className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 active:scale-95 transition-transform"
                        style={{ backgroundColor: col.hex }}
                        title={col.label}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <span className="w-px h-4 bg-gray-200 mx-1"></span>

            <button
              type="button"
              onClick={() => insertFormatting('`', '`')}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
              title="Inline Code (`code`)"
            >
              <Code className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => insertFormatting('```\n', '\n```')}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors flex items-center"
              title="Code Block (```)"
            >
              <span className="font-mono text-[9px] font-bold tracking-tight select-none">CODE</span>
            </button>

            <button
              type="button"
              onClick={() => insertFormatting('> ')}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
              title="Quote block (> )"
            >
              <Quote className="h-3.5 w-3.5" />
            </button>

            <span className="w-px h-4 bg-gray-200 mx-1"></span>

            <button
              type="button"
              onClick={() => insertFormatting('@')}
              className="px-2 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md text-[10px] font-bold tracking-wider transition-colors"
              title="Mention teammate, team or role"
            >
              @ MENTION
            </button>

            <button
              type="button"
              onClick={() => insertFormatting('#')}
              className="px-2 py-0.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md text-[10px] font-bold tracking-wider transition-colors"
              title="Reference task"
            >
              # TASK
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Rich input: mirror overlay + transparent textarea */}
            <div className="relative flex-1 bg-gray-50 border border-gray-200 focus-within:border-blue-500 rounded-xl transition-all overflow-hidden">
              {/* Mirror layer: renders colored badge chips behind the textarea */}
              <div
                ref={mirrorRef}
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none select-none overflow-hidden text-sm px-3.5 py-2.5"
                style={{
                  fontFamily: 'inherit',
                  lineHeight: '1.625',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  zIndex: 1,
                }}
                dangerouslySetInnerHTML={{ __html: parseInputPreview(inputText) }}
              />
              {/* Actual textarea on top with transparent text so mirror shows through */}
              <textarea
                ref={inputRef}
                rows={isSidebar ? 1 : 2}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onScroll={(e) => {
                  if (mirrorRef.current) {
                    mirrorRef.current.scrollTop = e.target.scrollTop;
                  }
                }}
                placeholder={inputText ? '' : 'Type message... Use @ for mentions, # for tasks, or toolbar to format.'}
                className="relative w-full text-sm bg-transparent px-3.5 py-2.5 outline-none resize-none"
                style={{
                  color: inputText ? 'transparent' : undefined,
                  caretColor: '#374151',
                  zIndex: 2,
                  lineHeight: '1.625',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-md transition-all flex items-center justify-center self-end hover:scale-105 active:scale-95"
            >
              <Send className="h-4.5 w-4.5" />
            </button>
          </div>

          {isNotifyMentionActive && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[10px] text-amber-800 mt-1">
              <Bell className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p><strong>@notify</strong> will send email alerts to recipients. Rate limited to once per 15 min per user.</p>
                <button
                  type="button"
                  onClick={() => setNotifyModal(true)}
                  className="mt-1 px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[10px] font-bold hover:bg-amber-700 transition-colors"
                >
                  Select who to notify →
                </button>
                {(notifyTarget !== 'everyone' || notifySelectedMembers.length > 0 || notifySelectedTeam) && (
                  <span className="ml-2 text-amber-700 font-semibold">
                    {notifyTarget === 'everyone' ? '📣 Everyone' : notifyTarget === 'team' && notifySelectedTeam ? `👥 ${notifySelectedTeam}` : notifySelectedMembers.length > 0 ? `👤 ${notifySelectedMembers.length} member(s)` : ''}
                  </span>
                )}
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/55 flex justify-center items-center z-[9999] p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="p-2 bg-red-50 text-red-500 rounded-lg">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete Message</h3>
            </div>
            
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this message? This action is permanent and cannot be undone.
            </p>

            <div className="bg-gray-50 border border-gray-150 rounded-xl p-3 text-xs italic text-gray-500 max-h-24 overflow-y-auto">
              &quot;{deleteConfirm.body}&quot;
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={() => handleDeleteMessage(deleteConfirm.id, 'me')}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold rounded-xl transition-all"
              >
                Delete for myself
              </button>
              
              {deleteConfirm.isMine || isManager ? (
                <button
                  onClick={() => handleDeleteMessage(deleteConfirm.id, 'everyone')}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
                >
                  Delete for everyone
                </button>
              ) : (
                <div className="text-[10px] text-gray-400 italic text-center py-1 select-none">
                  (Only senders or project managers can delete for everyone)
                </div>
              )}

              <button
                onClick={() => setDeleteConfirm(null)}
                className="w-full py-2 bg-white hover:bg-gray-50 text-gray-600 text-sm border rounded-xl font-medium transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* @notify Recipient Selection Modal */}
      {notifyModal && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[9999] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center gap-3">
              <Bell className="h-5 w-5 text-white" />
              <div>
                <h3 className="text-base font-bold text-white">Select Notification Recipients</h3>
                <p className="text-[11px] text-amber-100">Who should receive an email alert for this message?</p>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Email notifications are rate-limited to <strong>once per 15 minutes per recipient</strong>. Abuse will result in suspension of notify privileges.</span>
              </div>

              {/* Recipient Type */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Notify</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'everyone', label: '📣 Everyone', desc: 'All project members' },
                    { value: 'team', label: '👥 A Team', desc: 'Specific team' },
                    { value: 'members', label: '👤 Members', desc: 'Pick members' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setNotifyTarget(opt.value);
                        setNotifySelectedTeam('');
                        setNotifySelectedMembers([]);
                      }}
                      className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                        notifyTarget === opt.value
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/40'
                      }`}
                    >
                      <div className="text-sm font-semibold text-gray-800">{opt.label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Team selector */}
              {notifyTarget === 'team' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700">Select Team</label>
                  <select
                    value={notifySelectedTeam}
                    onChange={e => setNotifySelectedTeam(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Choose a team --</option>
                    {allTeams.map(t => (
                      <option key={t._id || t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Member picker */}
              {notifyTarget === 'members' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700">Select Members</label>
                  <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                    {projectMembers.length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-400 italic">No members found.</p>
                    )}
                    {projectMembers.map(m => (
                      <label key={m._id || m.username} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded accent-amber-500"
                          checked={notifySelectedMembers.includes(m.username)}
                          onChange={e => {
                            if (e.target.checked) {
                              setNotifySelectedMembers(prev => [...prev, m.username]);
                            } else {
                              setNotifySelectedMembers(prev => prev.filter(u => u !== m.username));
                            }
                          }}
                        />
                        <div>
                          <div className="text-xs font-semibold text-gray-800">{m.name || m.username}</div>
                          <div className="text-[10px] text-gray-400">@{m.username}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setNotifyModal(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (notifyTarget === 'team' && !notifySelectedTeam) {
                      return; // require team selection
                    }
                    if (notifyTarget === 'members' && notifySelectedMembers.length === 0) {
                      return; // require at least one member
                    }
                    setNotifyModal(false);
                  }}
                  disabled={
                    (notifyTarget === 'team' && !notifySelectedTeam) ||
                    (notifyTarget === 'members' && notifySelectedMembers.length === 0)
                  }
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
                >
                  Confirm Recipients
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
