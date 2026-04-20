'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X, Link2, Clock, Lock, Users, Trash2,
  Copy, Check, AlertCircle, Loader2, Search,
  Calendar, Shield, Globe2, ExternalLink, RefreshCw,
  ChevronDown, ChevronUp, ArrowUpDown, Eye, Download,
  CheckSquare, Square, BarChart2, XCircle, Filter
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrigin() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function shareUrl(token) {
  return `${getOrigin()}/shared/${token}`;
}

function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function expiryStatus(expiresAt) {
  if (!expiresAt) return { label: 'Never expires', type: 'never' };
  const now = new Date();
  const exp = new Date(expiresAt);
  if (exp <= now) return { label: 'Expired', type: 'expired' };
  const hoursLeft = (exp - now) / 3600000;
  if (hoursLeft < 24) return { label: `Expires in ${Math.ceil(hoursLeft)}h`, type: 'soon' };
  return {
    label: `Expires ${exp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    type: 'active',
  };
}

function buildUrl(base, params) {
  const q = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `${base}?${q}` : base;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ children, color = 'gray' }) {
  const cls = {
    gray:   'bg-gray-100 text-gray-600',
    blue:   'bg-blue-100 text-blue-700',
    green:  'bg-green-100 text-green-700',
    amber:  'bg-amber-100 text-amber-700',
    red:    'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
    violet: 'bg-violet-100 text-violet-700',
  }[color] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, sub }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-blue-500" />
      </div>
      <div>
        <p className="text-xs text-gray-400 leading-tight">{label}</p>
        <p className="text-lg font-bold text-gray-900 leading-tight tabular-nums">{value}</p>
        {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// Inline delete confirm — shown inside each card
function DeleteConfirm({ share, onConfirm, onCancel }) {
  return (
    <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl animate-slide-in">
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-red-700 leading-snug">
          Delete the share link for <span className="font-semibold">"{share.resourceName || 'this file'}"</span>? Anyone using it will lose access.
        </p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button onClick={onConfirm} className="px-2.5 py-1 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors">
          Delete
        </button>
        <button onClick={onCancel} className="px-2.5 py-1 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// Single share link card
function ShareCard({ share, copiedId, onCopy, onDelete, selected, onToggleSelect, selectMode }) {
  const [expanded,       setExpanded]       = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);

  const url    = shareUrl(share.token);
  const expiry = expiryStatus(share.expiresAt);
  const isExpired = expiry.type === 'expired';
  const isSoon    = expiry.type === 'soon';

  const accessType = share.allowedMembers?.length > 0 ? 'restricted' : 'anyone';

  return (
    <div className={`border rounded-xl transition-all ${
      isExpired
        ? 'border-gray-200 bg-gray-50/60 opacity-70'
        : selected
          ? 'border-blue-300 bg-blue-50/30'
          : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">

          {/* Select checkbox */}
          {selectMode && (
            <button
              onClick={() => onToggleSelect(share._id)}
              className="mt-0.5 shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
            >
              {selected
                ? <CheckSquare className="w-4 h-4 text-blue-500" />
                : <Square className="w-4 h-4" />
              }
            </button>
          )}

          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isExpired ? 'bg-gray-100' : 'bg-blue-50'
          }`}>
            <Link2 className={`w-5 h-5 ${isExpired ? 'text-gray-400' : 'text-blue-500'}`} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">
                  {share.resourceName || 'Unknown file'}
                </h3>
                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {accessType === 'anyone' ? (
                    <Badge color="green"><Globe2 className="w-3 h-3" />Anyone with link</Badge>
                  ) : (
                    <Badge color="violet"><Shield className="w-3 h-3" />{share.allowedMembers.length} member{share.allowedMembers.length > 1 ? 's' : ''}</Badge>
                  )}
                  {share.requirePassword && (
                    <Badge color="purple"><Lock className="w-3 h-3" />Password</Badge>
                  )}
                  <span className={`inline-flex items-center gap-1 text-xs ${
                    isExpired ? 'text-red-600 font-semibold' :
                    isSoon    ? 'text-amber-600 font-semibold' :
                                'text-gray-400'
                  }`}>
                    <Clock className="w-3 h-3" />
                    {expiry.label}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 shrink-0 text-right">
                <div>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1 justify-end"><Eye className="w-3 h-3" />Views</p>
                  <p className="text-sm font-bold text-gray-800 tabular-nums">{share.views ?? 0}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1 justify-end"><Download className="w-3 h-3" />Downloads</p>
                  <p className="text-sm font-bold text-gray-800 tabular-nums">{share.downloads ?? 0}</p>
                </div>
              </div>
            </div>

            {/* URL row + actions */}
            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 min-w-0 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 font-mono truncate">
                {url}
              </div>
              <button
                onClick={() => onCopy(url, share._id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all shrink-0 ${
                  copiedId === share._id
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {copiedId === share._id ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in new tab"
                className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => { setConfirmDelete(true); setExpanded(false); }}
                title="Delete share link"
                className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400">
              <Calendar className="w-3 h-3" />
              <span>Created {formatDate(share.createdAt)}</span>
              {share.createdBy?.username && (
                <><span>by</span><span className="font-medium text-gray-600">{share.createdBy.username}</span></>
              )}
              {share.allowedMembers?.length > 0 && (
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="flex items-center gap-0.5 ml-auto text-blue-500 hover:text-blue-700 font-medium transition-colors"
                >
                  {expanded ? 'Hide members' : 'View members'}
                  {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* Expanded members list */}
            {expanded && share.allowedMembers?.length > 0 && (
              <div className="mt-3 p-3 bg-violet-50 border border-violet-100 rounded-xl space-y-1.5">
                <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wide mb-2">Members with access</p>
                {share.allowedMembers.map((email, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                      {email.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-gray-700 truncate">{email}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Inline delete confirm */}
        {confirmDelete && (
          <DeleteConfirm
            share={share}
            onConfirm={() => { onDelete(share._id, share.token); setConfirmDelete(false); }}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── ShareLinksModal ──────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest first'     },
  { value: 'oldest',   label: 'Oldest first'      },
  { value: 'views',    label: 'Most viewed'        },
  { value: 'expiring', label: 'Expiring soon'      },
];

export default function ShareLinksModal({ isOpen, onClose, projectId, resourceId }) {
  const [shares,      setShares]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [copiedId,    setCopiedId]    = useState(null);
  const [filter,      setFilter]      = useState('all'); // all | restricted | expiring | expired
  const [sortBy,      setSortBy]      = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectMode,  setSelectMode]  = useState(false);
  const [selected,    setSelected]    = useState(new Set());
  const [showSort,    setShowSort]    = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const copiedTimerRef = useRef(null);
  const sortRef        = useRef(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchShares = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const url = buildUrl('/api/share/list', { projectId, resourceId });
      const res = await fetch(url);
      if (res.ok) {
        setShares(await res.json());
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to load share links.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [projectId, resourceId]);

  useEffect(() => {
    if (isOpen) {
      fetchShares();
      setSelected(new Set());
      setSelectMode(false);
    }
  }, [isOpen, fetchShares]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Sort menu outside click
  useEffect(() => {
    if (!showSort) return;
    const handler = e => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setShowSort(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSort]);

  // Cleanup copied timer on close
  useEffect(() => {
    if (!isOpen) clearTimeout(copiedTimerRef.current);
  }, [isOpen]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (shareId, token) => {
    try {
      const res = await fetch(`/api/share/${token}/delete`, { method: 'DELETE' });
      if (res.ok) {
        setShares(prev => prev.filter(s => s._id !== shareId));
        setSelected(prev => { const n = new Set(prev); n.delete(shareId); return n; });
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to delete share link.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  }, []);

  const handleBulkDelete = async () => {
    if (!selected.size) return;
    setBulkDeleting(true);
    const targets = shares.filter(s => selected.has(s._id));
    await Promise.all(targets.map(s => handleDelete(s._id, s.token)));
    setSelectMode(false);
    setSelected(new Set());
    setBulkDeleting(false);
  };

  const handleCopy = useCallback(async (url, id) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = Object.assign(document.createElement('textarea'), {
        value: url, style: 'position:fixed;opacity:0'
      });
      document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopiedId(id);
    clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredShares.length) setSelected(new Set());
    else setSelected(new Set(filteredShares.map(s => s._id)));
  };

  // ── Filter + Sort ─────────────────────────────────────────────────────────

  const filteredShares = useMemo(() => {
    let list = [...shares];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.resourceName?.toLowerCase().includes(q));
    }

    // Filter tab
    if (filter === 'restricted') {
      list = list.filter(s => s.allowedMembers?.length > 0);
    } else if (filter === 'expiring') {
      const in24h = new Date(Date.now() + 86400000);
      list = list.filter(s => s.expiresAt && new Date(s.expiresAt) > new Date() && new Date(s.expiresAt) <= in24h);
    } else if (filter === 'expired') {
      list = list.filter(s => s.expiresAt && new Date(s.expiresAt) <= new Date());
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'newest')   return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest')   return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'views')    return (b.views || 0) - (a.views || 0);
      if (sortBy === 'expiring') {
        if (!a.expiresAt) return 1;
        if (!b.expiresAt) return -1;
        return new Date(a.expiresAt) - new Date(b.expiresAt);
      }
      return 0;
    });

    return list;
  }, [shares, searchQuery, filter, sortBy]);

  // ── Summary stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total:      shares.length,
      totalViews: shares.reduce((s, x) => s + (x.views || 0), 0),
      totalDl:    shares.reduce((s, x) => s + (x.downloads || 0), 0),
      expired:    shares.filter(s => s.expiresAt && new Date(s.expiresAt) <= now).length,
      expiringSoon: shares.filter(s => {
        if (!s.expiresAt) return false;
        const exp = new Date(s.expiresAt);
        return exp > now && (exp - now) < 86400000;
      }).length,
    };
  }, [shares]);

  if (!isOpen) return null;

  const allFilteredSelected = filteredShares.length > 0 && filteredShares.every(s => selected.has(s._id));
  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';

  const FILTER_TABS = [
    { value: 'all',        label: 'All',          count: shares.length },
    { value: 'restricted', label: 'Restricted',   count: shares.filter(s => s.allowedMembers?.length > 0).length },
    { value: 'expiring',   label: 'Expiring soon', count: stats.expiringSoon },
    { value: 'expired',    label: 'Expired',       count: stats.expired },
  ];

  return (
    <>
      <style>{`
        @keyframes slide-in {
          from { opacity:0; transform:translateY(-4px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .animate-slide-in { animation: slide-in 0.15s ease-out; }
        @keyframes menu-in {
          from { opacity:0; transform:scale(0.96) translateY(-4px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        .animate-menu-in { animation: menu-in 0.13s cubic-bezier(0.16,1,0.3,1); }
      `}</style>

      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div>
              <h2 className="text-base font-bold text-gray-900">Share Links</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {shares.length} active link{shares.length !== 1 ? 's' : ''} · manage access and track usage
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchShares}
                disabled={loading}
                title="Refresh"
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Stats summary ── */}
          {!loading && shares.length > 0 && (
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/60 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
              <StatCard label="Total links"  value={stats.total}      icon={Link2}     />
              <StatCard label="Total views"  value={stats.totalViews} icon={Eye}       />
              <StatCard label="Downloads"    value={stats.totalDl}    icon={Download}  />
              <StatCard
                label="Expired / Expiring"
                value={`${stats.expired} / ${stats.expiringSoon}`}
                icon={Clock}
                sub={stats.expiringSoon > 0 ? `${stats.expiringSoon} expiring in 24h` : undefined}
              />
            </div>
          )}

          {/* ── Filters + search + sort ── */}
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/40 flex flex-col gap-3 shrink-0">
            {/* Filter tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    filter === tab.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`px-1.5 py-px rounded-full text-[10px] font-bold ${
                      filter === tab.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search + Sort + Select row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by file name…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Sort */}
              <div className="relative" ref={sortRef}>
                <button
                  onClick={() => setShowSort(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-gray-600"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{currentSortLabel}</span>
                </button>
                {showSort && (
                  <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-30 animate-menu-in">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value); setShowSort(false); }}
                        className={`flex items-center justify-between w-full px-3.5 py-2 text-xs transition-colors ${
                          sortBy === opt.value
                            ? 'text-blue-600 bg-blue-50 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                        {sortBy === opt.value && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Select mode toggle */}
              <button
                onClick={() => { setSelectMode(v => !v); setSelected(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                  selectMode
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{selectMode ? 'Cancel' : 'Select'}</span>
              </button>
            </div>
          </div>

          {/* ── Bulk actions bar — visible whenever select mode is on ── */}
          {selectMode && (
            <div className="px-6 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between shrink-0 animate-slide-in">
              <div className="flex items-center gap-3">
                {/* Master select-all checkbox — always clickable in select mode */}
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors"
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    allFilteredSelected && filteredShares.length > 0
                      ? 'bg-blue-600 border-blue-600'
                      : selected.size > 0
                        ? 'bg-blue-200 border-blue-400'   // indeterminate
                        : 'border-gray-400 bg-white'
                  }`}>
                    {allFilteredSelected && filteredShares.length > 0
                      ? <Check className="w-2.5 h-2.5 text-white" />
                      : selected.size > 0
                        ? <span className="w-1.5 h-0.5 bg-blue-700 rounded-full" />
                        : null
                    }
                  </span>
                  {selected.size === 0
                    ? `Select all ${filteredShares.length}`
                    : allFilteredSelected
                      ? 'Deselect all'
                      : `${selected.size} of ${filteredShares.length} selected`
                  }
                </button>
              </div>

              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  <>
                    <span className="text-xs text-blue-600 font-medium">{selected.size} selected</span>
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {bulkDeleting
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Deleting…</>
                        : <><Trash2 className="w-3.5 h-3.5" />Delete {selected.size} link{selected.size > 1 ? 's' : ''}</>
                      }
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">

            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p className="flex-1">{error}</p>
                <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                <p className="text-sm text-gray-400">Loading share links…</p>
              </div>
            ) : filteredShares.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-2">
                  <Link2 className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-700">No share links found</p>
                <p className="text-xs text-gray-400">
                  {searchQuery || filter !== 'all'
                    ? 'Try adjusting your filters or search'
                    : 'Create a share link from any file to get started'}
                </p>
                {(searchQuery || filter !== 'all') && (
                  <button
                    onClick={() => { setSearchQuery(''); setFilter('all'); }}
                    className="mt-2 text-xs text-blue-500 hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              filteredShares.map(share => (
                <ShareCard
                  key={share._id}
                  share={share}
                  copiedId={copiedId}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                  selected={selected.has(share._id)}
                  onToggleSelect={toggleSelect}
                  selectMode={selectMode}
                />
              ))
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between shrink-0">
            <p className="text-xs text-gray-400">
              {filteredShares.length} of {shares.length} link{shares.length !== 1 ? 's' : ''}
              {filter !== 'all' || searchQuery ? ' (filtered)' : ''}
            </p>
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}