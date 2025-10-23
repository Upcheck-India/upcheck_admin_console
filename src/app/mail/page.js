'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { useAuth } from '../../hooks/useAuth';
import { 
  Mail, Inbox, Send, Star, Trash2, File, Search, ChevronDown, MoreVertical, 
  Archive, Tag, Filter, RefreshCw, Settings, Plus, X, Check, AlertCircle,
  Clock, Paperclip, Flag, Users, Calendar
} from 'lucide-react';

// Constants
const EMAILS_PER_PAGE = 25;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const FOLDERS = [
  { id: 'inbox', name: 'Inbox', icon: Inbox },
  { id: 'starred', name: 'Starred', icon: Star },
  { id: 'sent', name: 'Sent', icon: Send },
  { id: 'drafts', name: 'Drafts', icon: File },
  { id: 'archive', name: 'Archive', icon: Archive },
  { id: 'trash', name: 'Trash', icon: Trash2 }
];

// Utility functions
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const stripLegacyQuoteMarkers = (html) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>(\s*)?-{2,}\s*(Original message|Forwarded message)\s*-{2,}<br\s*\/?>(.|\n|\r)*?$/i, '')
    .trim();
};

const buildReplyQuote = (email) => {
  const dateStr = email.date instanceof Date ? email.date.toLocaleString() : '';
  const cleaned = email.body || '';
  return (
    `<div style="margin:12px 0; color:#555; font-size:14px;">` +
      `On ${dateStr}, ${email.fromName} &lt;${email.from}&gt; wrote:` +
    `</div>` +
    `<blockquote style="margin:0 0 0 .8em; padding-left:.8em; border-left:2px solid #ddd">${cleaned}</blockquote>`
  );
};

const buildForwardQuote = (email) => {
  const dateStr = email.date instanceof Date ? email.date.toLocaleString() : '';
  return (
    `<div style="margin:12px 0; padding:10px; border:1px solid #e5e7eb; background:#f9fafb">` +
      `<div style="font-weight:600; margin-bottom:8px;">Forwarded message</div>` +
      `<div><span style="font-weight:600;">From:</span> ${email.fromName} &lt;${email.from}&gt;</div>` +
      `<div><span style="font-weight:600;">Date:</span> ${dateStr}</div>` +
      `<div><span style="font-weight:600;">Subject:</span> ${email.subject}</div>` +
    `</div>` +
    `<blockquote style="margin:8px 0 0 .8em; padding-left:.8em; border-left:2px solid #ddd">${email.body || ''}</blockquote>`
  );
};

const formatDate = (date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = diff / (1000 * 60 * 60);
  
  if (hours < 24) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (hours < 48) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

const normalizeEmail = (email, idx) => ({
  id: email._id || idx,
  from: email.from || '',
  fromName: email.fromName || email.from || '',
  subject: email.subject || '(No subject)',
  preview: (email.body || '').replace(/<[^>]+>/g, '').slice(0, 160),
  body: email.body || '',
  date: email.date ? new Date(email.date) : new Date(),
  read: !!email.read,
  starred: !!email.starred,
  folder: email.folder || 'inbox',
  hasAttachment: !!email.hasAttachment,
  labels: email.labels || [],
  attachmentsMeta: email.attachmentsMeta || [],
  priority: email.priority || 'normal',
  avatar: (email.fromName?.[0] || email.from?.[0] || 'U').toUpperCase(),
  messageId: email.messageId,
});

// Custom hooks
const useEmailFetch = (activeFolder) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchEmails = useCallback(async (folderOverride, pageOverride = 1, append = false) => {
    try {
      setLoading(true);
      setError(null);
      const folder = folderOverride || (activeFolder === 'sent' ? 'sent' : 'inbox');
      const res = await fetch(`/api/mail?folder=${folder}&page=${pageOverride}&limit=${EMAILS_PER_PAGE}`, { 
        credentials: 'include' 
      });
      
      if (!res.ok) throw new Error('Failed to load emails');
      
      const data = await res.json();
      const normalized = data.map(normalizeEmail);
      setEmails(prev => append ? [...prev, ...normalized] : normalized);
      setHasMore(data.length === EMAILS_PER_PAGE);
    } catch (e) {
      setError(e.message);
      console.error('Email fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeFolder]);

  return { emails, setEmails, loading, error, fetchEmails, hasMore };
};

const useUserOptions = () => {
  const [usersOptions, setUsersOptions] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const res = await fetch('/api/users', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch users');
        const data = await res.json();
        setUsersOptions(data.map(u => ({ 
          value: u.email, 
          label: `${u.username} (${u.email})` 
        })));
      } catch (e) {
        console.error('Users fetch error:', e);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  return { usersOptions, setUsersOptions, loadingUsers };
};

// Sub-components
const Sidebar = ({ activeFolder, setActiveFolder, onCompose, counts }) => {
  const getFolderCount = useCallback((folderId) => {
    if (folderId === 'starred') {
      return counts?.starred?.total || 0;
    }
    return counts?.byFolder?.[folderId]?.total || 0;
  }, [counts]);

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Mail</h1>
        <button 
          onClick={onCompose}
          className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
          aria-label="Compose new email"
        >
          <Plus className="w-4 h-4" />
          Compose
        </button>
      </div>
      
      <nav className="flex-1 p-4" aria-label="Mail folders">
        <ul className="space-y-1">
          {FOLDERS.map((folder) => {
            const Icon = folder.icon;
            const count = getFolderCount(folder.id);
            const unread = folder.id === 'starred' 
              ? 0 
              : (counts?.byFolder?.[folder.id]?.unread || 0);
            const isActive = activeFolder === folder.id;
            
            return (
              <li key={folder.id}>
                <button 
                  onClick={() => setActiveFolder(folder.id)}
                  className={`flex items-center w-full px-3 py-2.5 text-left rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5 mr-3" aria-hidden="true" />
                  <span className="flex-1">{folder.name}</span>
                  {(unread > 0) ? (
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                      {unread}
                    </span>
                  ) : (count > 0) ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button 
          className="flex items-center w-full px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 mr-3" aria-hidden="true" />
          Settings
        </button>
      </div>
    </div>
  );
};

const EmailListItem = ({ email, isSelected, onToggleSelect, onOpen, onToggleStar }) => (
  <li 
    className={`px-4 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${
      !email.read ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white'
    } ${isSelected ? 'bg-blue-100' : ''}`}
    onClick={onOpen}
  >
    <div className="flex items-start gap-4">
      <input
        type="checkbox"
        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          onToggleSelect(email.id);
        }}
        aria-label={`Select email from ${email.fromName}`}
      />
      
      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-700 flex-shrink-0">
        {email.avatar}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <p className={`text-sm font-medium truncate ${
              !email.read ? 'text-gray-900' : 'text-gray-700'
            }`}>
              {email.fromName}
            </p>
            {email.priority === 'high' && (
              <Flag className="w-4 h-4 text-red-500 flex-shrink-0" aria-label="High priority" />
            )}
            {email.hasAttachment && (
              <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" aria-label="Has attachment" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500">{formatDate(email.date)}</span>
            <button 
              className="text-gray-400 hover:text-yellow-500 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar?.(!email.starred);
              }}
              aria-label={email.starred ? 'Unstar email' : 'Star email'}
            >
              <Star className={`h-4 w-4 ${email.starred ? 'text-yellow-500 fill-current' : ''}`} />
            </button>
          </div>
        </div>
        
        <p className={`text-sm mb-1 ${!email.read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
          {email.subject}
        </p>
        
        <p className="text-sm text-gray-500 line-clamp-2">
          {email.preview}
        </p>

        {email.labels.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {email.labels.map((label) => (
              <span 
                key={label}
                className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  </li>
);

const ComposeModal = ({ 
  show, 
  onClose, 
  composeData, 
  setComposeData,
  usersOptions,
  loadingUsers,
  onCreateAddress,
  onSend,
  sending,
  userEmail
}) => {
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    const validFiles = newFiles.filter(f => {
      if (f.size > MAX_FILE_SIZE) {
        setFileError(`File ${f.name} exceeds 10MB limit`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...validFiles]);
    setFileError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer?.files || []);
    const validFiles = droppedFiles.filter(f => f.size <= MAX_FILE_SIZE);
    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-title"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 id="compose-title" className="text-lg font-semibold text-gray-900">New Message</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close compose window"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
          <div>
            <label htmlFor="to-field" className="sr-only">To</label>
            <CreatableSelect
              id="to-field"
              isMulti
              isLoading={loadingUsers}
              options={usersOptions}
              value={composeData.to}
              onChange={(v) => setComposeData(prev => ({ ...prev, to: v || [] }))}
              onCreateOption={(input) => onCreateAddress(input, 'to')}
              placeholder="To"
              classNamePrefix="select"
              aria-label="To recipients"
            />
            <div className="mt-2 text-xs text-gray-600">
              <button 
                type="button" 
                onClick={() => setShowCcBcc(s => !s)} 
                className="underline hover:text-gray-900"
              >
                {showCcBcc ? 'Hide Cc/Bcc' : 'Add Cc/Bcc'}
              </button>
            </div>
            {showCcBcc && (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                <CreatableSelect
                  isMulti
                  isLoading={loadingUsers}
                  options={usersOptions}
                  value={composeData.cc}
                  onChange={(v) => setComposeData(prev => ({ ...prev, cc: v || [] }))}
                  onCreateOption={(input) => onCreateAddress(input, 'cc')}
                  placeholder="Cc"
                  classNamePrefix="select"
                  aria-label="Cc recipients"
                />
                <CreatableSelect
                  isMulti
                  isLoading={loadingUsers}
                  options={usersOptions}
                  value={composeData.bcc}
                  onChange={(v) => setComposeData(prev => ({ ...prev, bcc: v || [] }))}
                  onCreateOption={(input) => onCreateAddress(input, 'bcc')}
                  placeholder="Bcc"
                  classNamePrefix="select"
                  aria-label="Bcc recipients"
                />
              </div>
            )}
            <div className="mt-2 text-xs text-gray-500">From: {userEmail || '—'}</div>
          </div>
          
          <div>
            <label htmlFor="subject-field" className="sr-only">Subject</label>
            <input
              id="subject-field"
              type="text"
              placeholder="Subject"
              value={composeData.subject}
              onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div 
            className="flex-1" 
            onDragOver={(e) => e.preventDefault()} 
            onDrop={handleDrop}
          >
            <label htmlFor="body-field" className="sr-only">Message body</label>
            <textarea
              id="body-field"
              placeholder="Write your message..."
              value={composeData.body}
              onChange={(e) => setComposeData(prev => ({ ...prev, body: e.target.value }))}
              className="w-full h-full min-h-[200px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="mt-3">
              <label htmlFor="file-input" className="block text-sm font-medium text-gray-700 mb-1">
                Attachments
              </label>
              <input
                id="file-input"
                type="file"
                multiple
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {fileError && (
                <p className="mt-1 text-xs text-red-600">{fileError}</p>
              )}
              {files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 border rounded text-xs text-gray-700 bg-gray-50">
                      <Paperclip className="w-3 h-3" aria-hidden="true" />
                      <span title={f.name} className="max-w-[180px] truncate">{f.name}</span>
                      <button 
                        type="button" 
                        className="text-gray-400 hover:text-red-600" 
                        onClick={() => removeFile(i)}
                        aria-label={`Remove ${f.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between p-4 border-t border-gray-200">
          <div className="flex items-center gap-2" />
          <div className="flex items-center gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              onClick={() => onSend(files)}
              disabled={sending || !composeData.to?.length}
              className={`px-6 py-2 rounded-md text-white flex items-center gap-2 ${
                sending || !composeData.to?.length
                  ? 'bg-blue-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EmailDetailModal = ({ email, onClose, onReply, onForward, onArchive, onTrash, onDelete, onToggleStar }) => {
  if (!email) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-subject"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-700 flex-shrink-0">
              {email.avatar}
            </div>
            <div className="min-w-0">
              <h2 id="email-subject" className="text-lg font-semibold text-gray-900 truncate">{email.subject}</h2>
              <p className="text-sm text-gray-600 truncate">{email.fromName} &lt;{email.from}&gt;</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Close email"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="text-sm text-gray-600">
            <div><span className="font-medium">From:</span> {email.fromName} &lt;{email.from}&gt;</div>
            <div><span className="font-medium">Date:</span> {email.date.toLocaleString()}</div>
          </div>
          <div className="prose max-w-none">
            <div 
              className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: email.body }}
            />
          </div>
          {email.attachmentsMeta && email.attachmentsMeta.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Attachments</div>
              <ul className="space-y-1">
                {email.attachmentsMeta.map((a, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                    <Paperclip className="w-4 h-4" />
                    <span>{a.filename}</span>
                    {a.contentType && <span className="text-gray-400">({a.contentType})</span>}
                    {email.messageId != null && typeof a.index === 'number' && (
                      <>
                        <a
                          href={`/api/mail/attachment/${encodeURIComponent(email.messageId)}/${a.index}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </a>
                        <a
                          href={`/api/mail/attachment/${encodeURIComponent(email.messageId)}/${a.index}?download=1`}
                          className="text-blue-600 hover:underline"
                        >
                          Download
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between p-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md" onClick={() => onToggleStar?.(!email.starred)}>
              <Star className={`w-4 h-4 ${email.starred ? 'fill-current' : ''}`} />
              {email.starred ? 'Unstar' : 'Star'}
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md" onClick={onArchive}>
              <Archive className="w-4 h-4" />
              Archive
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-md" onClick={onTrash}>
              <Trash2 className="w-4 h-4" />
              Trash
            </button>
            {email.folder === 'trash' && (
              <button className="flex items-center gap-2 px-3 py-2 text-red-700 hover:bg-red-50 rounded-md" onClick={onDelete}>
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50" onClick={onReply}>
              Reply
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" onClick={onForward}>
              Forward
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main component
const MailPage = () => {
  const { user, isLoading: authLoading } = useAuth(false);
  const [selectedMails, setSelectedMails] = useState([]);
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [filterBy, setFilterBy] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [composeData, setComposeData] = useState({ to: [], cc: [], bcc: [], subject: '', body: '' });
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);

  const { emails, setEmails, loading, error, fetchEmails, hasMore } = useEmailFetch(activeFolder);
  const { usersOptions, setUsersOptions, loadingUsers } = useUserOptions();
  const [counts, setCounts] = useState(null);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/mail/counts', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCounts(data);
      }
    } catch (e) {
      console.error('Counts fetch error:', e);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchEmails(undefined, 1, false);
    fetchCounts();
  }, [activeFolder, fetchEmails]);

  const onCreateAddress = useCallback((input, field) => {
    const trimmed = input.trim();
    if (!validateEmail(trimmed)) return;
    const option = { value: trimmed, label: trimmed };
    setUsersOptions(prev => prev.some(o => o.value === trimmed) ? prev : [...prev, option]);
    setComposeData(prev => ({ ...prev, [field]: [...(prev[field] || []), option] }));
  }, [setUsersOptions]);

  const performMailAction = useCallback(async (ids, action, value) => {
    try {
      await fetch('/api/mail/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids, action, value })
      });
      await fetchEmails(undefined, 1, false);
      await fetchCounts();
      setSelectedMails([]);
    } catch (e) {
      console.error('Action error:', e);
      alert('Failed to perform action');
    }
  }, [fetchEmails, fetchCounts]);

  const filteredAndSortedEmails = useMemo(() => {
    let filtered = emails.filter(email => {
      const folderMatch = activeFolder === 'inbox' || 
        (activeFolder === 'starred' && email.starred) ||
        email.folder === activeFolder;
      
      const searchLower = searchTerm.toLowerCase();
      const searchMatch = searchTerm === '' || 
        email.subject.toLowerCase().includes(searchLower) ||
        email.from.toLowerCase().includes(searchLower) ||
        email.fromName.toLowerCase().includes(searchLower) ||
        email.preview.toLowerCase().includes(searchLower);
      
      const priorityMatch = filterBy === 'all' || 
        (filterBy === 'unread' && !email.read) ||
        (filterBy === 'starred' && email.starred) ||
        (filterBy === 'attachments' && email.hasAttachment) ||
        (filterBy === 'priority' && email.priority === 'high');

      return folderMatch && searchMatch && priorityMatch;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.date.getTime() - a.date.getTime();
        case 'oldest':
          return a.date.getTime() - b.date.getTime();
        case 'sender':
          return a.fromName.localeCompare(b.fromName);
        case 'subject':
          return a.subject.localeCompare(b.subject);
        default:
          return b.date.getTime() - a.date.getTime();
      }
    });

    return filtered;
  }, [emails, activeFolder, searchTerm, filterBy, sortBy]);

  const toggleSelectMail = useCallback((id) => {
    setSelectedMails(prev => 
      prev.includes(id) 
        ? prev.filter(mailId => mailId !== id)
        : [...prev, id]
    );
  }, []);

  const selectAllMails = useCallback(() => {
    if (selectedMails.length === filteredAndSortedEmails.length) {
      setSelectedMails([]);
    } else {
      setSelectedMails(filteredAndSortedEmails.map(email => email.id));
    }
  }, [selectedMails.length, filteredAndSortedEmails]);

  const handleCompose = useCallback(() => {
    setShowCompose(true);
    setComposeData({ to: [], cc: [], bcc: [], subject: '', body: '' });
  }, []);

  const handleSendEmail = useCallback(async (files) => {
    if (sending) return;
    try {
      setSending(true);
      const fd = new FormData();
      fd.append('to', composeData.to.map(o => o.value).join(', '));
      if (composeData.cc?.length) fd.append('cc', composeData.cc.map(o => o.value).join(', '));
      if (composeData.bcc?.length) fd.append('bcc', composeData.bcc.map(o => o.value).join(', '));
      fd.append('subject', composeData.subject || '');
      fd.append('body', composeData.body || '');
      files.forEach(f => fd.append('attachments', f));

      const res = await fetch('/api/send-email', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send email');
      }
      
      setShowCompose(false);
      setComposeData({ to: [], cc: [], bcc: [], subject: '', body: '' });
      setActiveFolder('sent');
      await fetchEmails('sent');
    } catch (e) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  }, [sending, composeData, fetchEmails]);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        activeFolder={activeFolder}
        setActiveFolder={setActiveFolder}
        onCompose={handleCompose}
        counts={counts}
      />
      
      <div className="flex-1 flex flex-col bg-white">
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white"
                placeholder="Search mail..."
                aria-label="Search mail"
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Toggle filters"
              aria-expanded={showFilters}
            >
              <Filter className="h-5 w-5 text-gray-500" aria-hidden="true" />
            </button>
            <button 
              onClick={() => fetchEmails()}
              disabled={loading}
              className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              aria-label="Refresh emails"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin text-blue-600' : 'text-gray-500'}`} aria-hidden="true" />
            </button>
          </div>

          {showFilters && (
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <label htmlFor="filter-select" className="text-sm font-medium text-gray-700">Filter:</label>
                <select 
                  id="filter-select"
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="unread">Unread</option>
                  <option value="starred">Starred</option>
                  <option value="attachments">With Attachments</option>
                  <option value="priority">High Priority</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="sort-select" className="text-sm font-medium text-gray-700">Sort:</label>
                <select 
                  id="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="sender">Sender</option>
                  <option value="subject">Subject</option>
                </select>
              </div>
            </div>
          )}

          {selectedMails.length > 0 && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-sm text-blue-700 font-medium">
                {selectedMails.length} selected
              </span>
              <div className="flex items-center gap-1 ml-auto">
                <button 
                  className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                  aria-label="Archive selected"
                  onClick={() => performMailAction(selectedMails, 'archive')}
                >
                  <Archive className="w-4 h-4" />
                </button>
                <button 
                  className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                  aria-label="Star selected"
                  onClick={() => performMailAction(selectedMails, 'star', true)}
                >
                  <Star className="w-4 h-4" />
                </button>
                <button 
                  className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                  aria-label="Delete selected"
                  onClick={() => performMailAction(selectedMails, activeFolder === 'trash' ? 'delete' : 'trash')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setSelectedMails([])}
                  className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                  aria-label="Clear selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading && emails.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredAndSortedEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Mail className="h-16 w-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium">No messages found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center px-4 py-3 border-b border-gray-200 bg-gray-50">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={selectedMails.length === filteredAndSortedEmails.length && filteredAndSortedEmails.length > 0}
                  onChange={selectAllMails}
                  aria-label="Select all emails"
                />
                <span className="ml-3 text-sm text-gray-600">
                  {filteredAndSortedEmails.length} conversation{filteredAndSortedEmails.length !== 1 ? 's' : ''}
                </span>
              </div>

              <ul className="divide-y divide-gray-200">
                {filteredAndSortedEmails.map((email) => (
                  <EmailListItem
                    key={email.id}
                    email={email}
                    isSelected={selectedMails.includes(email.id)}
                    onToggleSelect={toggleSelectMail}
                    onOpen={() => setSelectedEmail(email)}
                    onToggleStar={(checked) => performMailAction([email.id], 'star', checked)}
                  />
                ))}
              </ul>
              {hasMore && (
                <div className="p-4 flex justify-center">
                  <button
                    disabled={loading}
                    onClick={() => { const next = page + 1; setPage(next); fetchEmails(undefined, next, true); }}
                    className="px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ComposeModal
        show={showCompose}
        onClose={() => setShowCompose(false)}
        composeData={composeData}
        setComposeData={setComposeData}
        usersOptions={usersOptions}
        loadingUsers={loadingUsers}
        onCreateAddress={onCreateAddress}
        onSend={handleSendEmail}
        sending={sending}
        userEmail={user?.email}
      />

      <EmailDetailModal
        email={selectedEmail}
        onClose={() => setSelectedEmail(null)}
        onReply={() => {
          if (!selectedEmail) return;
          const subj = selectedEmail.subject?.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`;
          const quoted = buildReplyQuote(selectedEmail);
          setSelectedEmail(null);
          setComposeData({
            to: [{ value: selectedEmail.from, label: selectedEmail.from }],
            cc: [],
            bcc: [],
            subject: subj,
            body: `${stripLegacyQuoteMarkers('')}${quoted}`,
          });
          setShowCompose(true);
        }}
        onForward={() => {
          if (!selectedEmail) return;
          const subj = selectedEmail.subject?.startsWith('Fwd:') ? selectedEmail.subject : `Fwd: ${selectedEmail.subject}`;
          const quoted = buildForwardQuote(selectedEmail);
          setSelectedEmail(null);
          setComposeData({
            to: [],
            cc: [],
            bcc: [],
            subject: subj,
            body: `${stripLegacyQuoteMarkers('')}${quoted}`,
          });
          setShowCompose(true);
        }}
        onArchive={() => { if (selectedEmail) { const id = selectedEmail.id; setSelectedEmail(null); performMailAction([id], 'archive'); } }}
        onTrash={() => { if (selectedEmail) { const id = selectedEmail.id; setSelectedEmail(null); performMailAction([id], 'trash'); } }}
        onDelete={() => { if (selectedEmail) { const id = selectedEmail.id; setSelectedEmail(null); performMailAction([id], 'delete'); } }}
        onToggleStar={(checked) => { if (selectedEmail) { const id = selectedEmail.id; performMailAction([id], 'star', checked); } }}
      />
    </div>
  );
};

export default MailPage;