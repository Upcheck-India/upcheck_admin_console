'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Activity, FileText, Folder, Upload, Download, Edit2, Trash2,
  Copy, Move, Lock, Unlock, GitBranch, Clock, RefreshCw,
  ChevronDown, ChevronUp, AlertCircle, Users, Search,
  X, Filter, BarChart2, FileDown
} from 'lucide-react';

// ─── Action config ────────────────────────────────────────────────────────────

const ACTION_CONFIG = {
  file_created:       { icon: FileText,  color: 'text-emerald-600', bg: 'bg-emerald-50',  label: 'created file',            category: 'files'    },
  file_uploaded:      { icon: Upload,    color: 'text-emerald-600', bg: 'bg-emerald-50',  label: 'uploaded',                category: 'files'    },
  file_downloaded:    { icon: Download,  color: 'text-blue-600',    bg: 'bg-blue-50',     label: 'downloaded',              category: 'files'    },
  file_renamed:       { icon: Edit2,     color: 'text-amber-600',   bg: 'bg-amber-50',    label: 'renamed',                 category: 'files'    },
  file_deleted:       { icon: Trash2,    color: 'text-red-500',     bg: 'bg-red-50',      label: 'deleted',                 category: 'files'    },
  file_duplicated:    { icon: Copy,      color: 'text-indigo-600',  bg: 'bg-indigo-50',   label: 'duplicated',              category: 'files'    },
  file_moved:         { icon: Move,      color: 'text-violet-600',  bg: 'bg-violet-50',   label: 'moved',                   category: 'files'    },
  file_updated:       { icon: Edit2,     color: 'text-blue-600',    bg: 'bg-blue-50',     label: 'updated',                 category: 'files'    },
  folder_created:     { icon: Folder,    color: 'text-blue-600',    bg: 'bg-blue-50',     label: 'created folder',          category: 'folders'  },
  folder_renamed:     { icon: Edit2,     color: 'text-amber-600',   bg: 'bg-amber-50',    label: 'renamed folder',          category: 'folders'  },
  folder_deleted:     { icon: Trash2,    color: 'text-red-500',     bg: 'bg-red-50',      label: 'deleted folder',          category: 'folders'  },
  folder_moved:       { icon: Move,      color: 'text-violet-600',  bg: 'bg-violet-50',   label: 'moved folder',            category: 'folders'  },
  folder_duplicate:   { icon: Copy,      color: 'text-indigo-600',  bg: 'bg-indigo-50',   label: 'duplicated folder',       category: 'folders'  },
  share_link_created: { icon: Activity,  color: 'text-pink-600',    bg: 'bg-pink-50',     label: 'created share link for',  category: 'sharing'  },
  share_link_updated: { icon: Edit2,     color: 'text-pink-600',    bg: 'bg-pink-50',     label: 'updated share link for',  category: 'sharing'  },
  share_link_deleted: { icon: Trash2,    color: 'text-red-500',     bg: 'bg-red-50',      label: 'deleted share link for',  category: 'sharing'  },
  member_add:         { icon: Users,     color: 'text-emerald-600', bg: 'bg-emerald-50',  label: 'added member to',         category: 'members'  },
  member_remove:      { icon: Users,     color: 'text-amber-600',   bg: 'bg-amber-50',    label: 'removed member from',     category: 'members'  },
  member_role_change: { icon: Users,     color: 'text-blue-600',    bg: 'bg-blue-50',     label: 'changed role for',        category: 'members'  },
  password_added:     { icon: Lock,      color: 'text-amber-600',   bg: 'bg-amber-50',    label: 'added password to',       category: 'security' },
  password_removed:   { icon: Unlock,    color: 'text-gray-500',    bg: 'bg-gray-100',    label: 'removed password from',   category: 'security' },
  version_created:    { icon: GitBranch, color: 'text-teal-600',    bg: 'bg-teal-50',     label: 'uploaded new version of', category: 'versions' },
  version_reverted:   { icon: RefreshCw, color: 'text-orange-600',  bg: 'bg-orange-50',   label: 'reverted version of',     category: 'versions' },
  project_created:    { icon: Folder,    color: 'text-emerald-600', bg: 'bg-emerald-50',  label: 'created project',         category: 'project'  },
  project_updated:    { icon: Edit2,     color: 'text-blue-600',    bg: 'bg-blue-50',     label: 'updated project',         category: 'project'  },
};

const CATEGORIES = [
  { value: 'all',      label: 'All'      },
  { value: 'files',    label: 'Files'    },
  { value: 'folders',  label: 'Folders'  },
  { value: 'sharing',  label: 'Sharing'  },
  { value: 'members',  label: 'Members'  },
  { value: 'security', label: 'Security' },
  { value: 'versions', label: 'Versions' },
];

const FALLBACK_CONFIG = { icon: Activity, color: 'text-gray-500', bg: 'bg-gray-100', label: '', category: 'other' };

function getConfig(action) {
  return ACTION_CONFIG[action] || { ...FALLBACK_CONFIG, label: action?.replace(/_/g, ' ') || 'performed action' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(timestamp) {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  const now   = new Date();
  const diff  = now - date;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTimeFull(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Bug fix: use calendar-day boundaries, not rolling 24h window
function dayLabel(timestamp) {
  const d     = new Date(timestamp);
  const now   = new Date();
  const dDay  = new Date(d.getFullYear(),   d.getMonth(),   d.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff  = Math.round((today - dDay) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function groupByDate(activities) {
  const groups = [];
  let currentLabel = null;
  activities.forEach(a => {
    const label = dayLabel(a.timestamp);
    if (label !== currentLabel) { currentLabel = label; groups.push({ label, items: [] }); }
    groups[groups.length - 1].items.push(a);
  });
  return groups;
}

function initials(name = '') {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function hue(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff;
  return h % 360;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + ['B','KB','MB','GB'][i];
}

function exportCSV(activities) {
  const rows = [
    ['Timestamp', 'User', 'Action', 'Target', 'Details'],
    ...activities.map(a => [
      formatTimeFull(a.timestamp),
      a.user?.username || 'Unknown',
      a.action || '',
      a.targetName || a.resourceName || a.details?.fileName || '',
      JSON.stringify(a.details || {}),
    ]),
  ];
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const el   = Object.assign(document.createElement('a'), { href: url, download: `activity-${Date.now()}.csv` });
  el.click(); URL.revokeObjectURL(url);
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ activities }) {
  const { counts, topUser } = useMemo(() => {
    const c = {}, u = {};
    activities.forEach(a => {
      const cat = getConfig(a.action).category;
      c[cat] = (c[cat] || 0) + 1;
      const name = a.user?.username;
      if (name) u[name] = (u[name] || 0) + 1;
    });
    return { counts: c, topUser: Object.entries(u).sort((x, y) => y[1] - x[1])[0] };
  }, [activities]);

  const top3 = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5 bg-gray-50/80 border border-gray-100 rounded-xl text-xs mb-3">
      <div className="flex items-center gap-1.5 text-gray-500">
        <BarChart2 className="w-3.5 h-3.5 text-gray-400" />
        <span className="font-bold text-gray-700">{activities.length}</span> events
      </div>
      <span className="text-gray-200">|</span>
      {top3.map(([cat, count]) => (
        <span key={cat} className="flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-600">
          <span className="font-bold text-gray-800">{count}</span> {cat}
        </span>
      ))}
      {topUser && (
        <span className="flex items-center gap-1 ml-auto text-gray-400">
          Most active: <span className="font-semibold text-gray-700 ml-0.5">{topUser[0]}</span>
        </span>
      )}
    </div>
  );
}

// ─── Activity row ─────────────────────────────────────────────────────────────

function ActivityRow({ activity, isLast }) {
  const cfg        = getConfig(activity.action);
  const Icon       = cfg.icon;
  const username   = activity.user?.username || 'Unknown';
  const h          = hue(username);
  const targetName = activity.targetName || activity.resourceName || activity.details?.fileName || '';
  const targetType = activity.targetType  || activity.resourceType || '';
  const TargetIcon = targetType === 'folder' ? Folder : targetType === 'file' ? FileText : null;

  return (
    <div className={`relative flex gap-3 py-3 ${!isLast ? 'border-b border-gray-50' : ''}`}>
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${cfg.bg} shrink-0 z-10`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-100 mt-1" />}
      </div>

      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-gray-800 leading-snug flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 mr-1">
              {/* Bug fix: use inline style for exact px size instead of invalid w-4.5 Tailwind class */}
              <span
                className="inline-flex items-center justify-center rounded-full text-white font-bold shrink-0"
                style={{ width: 18, height: 18, minWidth: 18, fontSize: 9, background: `hsl(${h}, 55%, 55%)` }}
              >
                {initials(username)}
              </span>
              <span className="font-semibold text-gray-900">{username}</span>
            </span>
            <span className="text-gray-500">{cfg.label}</span>
            {targetName && (
              <>
                <span className="text-gray-300 mx-1">·</span>
                <span className="inline-flex items-center gap-1 font-medium text-gray-800">
                  {TargetIcon && <TargetIcon className="w-3 h-3 text-gray-400 shrink-0" />}
                  {targetName}
                </span>
              </>
            )}
          </p>
          <time
            title={formatTimeFull(activity.timestamp)}
            className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap mt-0.5 cursor-default"
          >
            {formatTime(activity.timestamp)}
          </time>
        </div>

        {activity.details && (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {activity.details.path && (
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                <Folder className="w-2.5 h-2.5 shrink-0" />{activity.details.path}
              </span>
            )}
            {activity.details.versionNumber && (
              <span className="text-[11px] text-teal-600 font-medium">v{activity.details.versionNumber}</span>
            )}
            {activity.details.changeNote && (
              <span className="text-[11px] text-gray-500 italic">"{activity.details.changeNote}"</span>
            )}
            {activity.details.fileSize && (
              <span className="text-[11px] text-gray-400">{formatBytes(activity.details.fileSize)}</span>
            )}
            {activity.details.oldName && activity.details.newName && (
              <span className="text-[11px] text-amber-600 font-medium">
                "{activity.details.oldName}" → "{activity.details.newName}"
              </span>
            )}
            {activity.metadata?.targetUser && (
              <span className="text-[11px] text-gray-500">User: {activity.metadata.targetUser}</span>
            )}
            {activity.metadata?.role && (
              <span className="text-[11px] text-gray-500">Role: {activity.metadata.role}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Date group with collapse ─────────────────────────────────────────────────

function DateGroup({ group, onToggle }) {
  return (
    <div className="mb-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full py-1 group"
      >
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap group-hover:text-gray-600 transition-colors">
          {group.label}
        </span>
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-gray-300 group-hover:text-gray-500 transition-colors">
          {group.collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </span>
        <span className="text-[10px] text-gray-400 tabular-nums">{group.items.length}</span>
      </button>

      {!group.collapsed && (
        <div>
          {group.items.map((activity, i) => (
            <ActivityRow
              key={activity._id ?? `${activity.timestamp}-${i}`}
              activity={activity}
              isLast={i === group.items.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ActivityLog ─────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function ActivityLog({ projectId, limit = 20, showHeader = true }) {
  const [activities,   setActivities]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [error,        setError]        = useState(null);
  const [total,        setTotal]        = useState(0);
  const [offset,       setOffset]       = useState(0);
  const [refreshing,   setRefreshing]   = useState(false);
  const [category,     setCategory]     = useState('all');
  const [userFilter,   setUserFilter]   = useState('');
  const [search,       setSearch]       = useState('');
  const [showFilters,  setShowFilters]  = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  // Bug fix: flag to prevent auto-refresh racing with manual refresh
  const isRefreshingRef = useRef(false);
  const intervalRef     = useRef(null);

  const fetchActivities = useCallback(async ({ replace = true, off = 0 } = {}) => {
    if (!projectId) return;
    replace ? setLoading(true) : setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        projectId, limit: String(replace ? limit : PAGE_SIZE), offset: String(off),
      });
      if (category !== 'all') params.set('category', category);
      if (userFilter.trim())  params.set('user', userFilter.trim());

      const res = await fetch(`/api/documentation/activity?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      const logs = data.logs || [];

      setActivities(prev => replace ? logs : [...prev, ...logs]);
      setTotal(data.total || 0);
      setOffset(off + logs.length);
    } catch {
      setError('Could not load activity log.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [projectId, limit, category, userFilter]);

  // Initial load + auto-refresh (60s)
  useEffect(() => {
    fetchActivities({ replace: true, off: 0 });
    intervalRef.current = setInterval(() => {
      // Bug fix: skip auto-refresh if manual refresh is in flight
      if (!isRefreshingRef.current) fetchActivities({ replace: true, off: 0 });
    }, 60000);
    return () => clearInterval(intervalRef.current);
  }, [fetchActivities]);

  // Re-fetch when server-side filters change
  useEffect(() => {
    setOffset(0);
    setCollapsedGroups(new Set());
    fetchActivities({ replace: true, off: 0 });
  }, [category, userFilter]);

  // Bug fix: refreshing flag tied to actual completion, not setTimeout
  const handleRefresh = async () => {
    isRefreshingRef.current = true;
    setRefreshing(true);
    await fetchActivities({ replace: true, off: 0 });
    setRefreshing(false);
    isRefreshingRef.current = false;
  };

  const handleLoadMore = () => fetchActivities({ replace: false, off: offset });

  // Client-side search filter (instant, no API roundtrip)
  const displayed = useMemo(() => {
    if (!search.trim()) return activities;
    const q = search.toLowerCase();
    return activities.filter(a => {
      const target = (a.targetName || a.resourceName || a.details?.fileName || '').toLowerCase();
      const user   = (a.user?.username || '').toLowerCase();
      return target.includes(q) || user.includes(q);
    });
  }, [activities, search]);

  const uniqueUsers = useMemo(() =>
    [...new Set(activities.map(a => a.user?.username).filter(Boolean))].sort()
  , [activities]);

  const groups = useMemo(() => {
    return groupByDate(displayed).map(g => ({
      ...g, collapsed: collapsedGroups.has(g.label),
    }));
  }, [displayed, collapsedGroups]);

  const toggleGroup  = label => setCollapsedGroups(prev => {
    const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n;
  });
  const collapseAll = () => setCollapsedGroups(new Set(groups.map(g => g.label)));
  const expandAll   = () => setCollapsedGroups(new Set());
  const allCollapsed = groups.length > 0 && groups.every(g => g.collapsed);
  const hasMore      = activities.length < total;
  const hasFilters   = category !== 'all' || userFilter || search;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse pt-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3 items-start py-2">
            <div className="w-8 h-8 rounded-xl bg-gray-100 shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3.5 bg-gray-100 rounded-md" style={{ width: `${55 + (i % 3) * 15}%` }} />
              <div className="h-2.5 bg-gray-100 rounded-md w-2/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (error && activities.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center gap-2">
        <AlertCircle className="w-8 h-8 text-red-300" />
        <p className="text-sm text-gray-500">{error}</p>
        <button onClick={handleRefresh} className="text-xs text-blue-600 hover:underline">Try again</button>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────

  if (displayed.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center gap-2">
        <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-2">
          <Activity className="w-5 h-5 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-600">
          {hasFilters ? 'No matching activity' : 'No activity yet'}
        </p>
        <p className="text-xs text-gray-400">
          {hasFilters ? 'Try adjusting your filters' : 'Actions on this project will appear here.'}
        </p>
        {hasFilters && (
          <button
            onClick={() => { setCategory('all'); setUserFilter(''); setSearch(''); }}
            className="mt-1 text-xs text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">

      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900">Activity</h3>
            {total > 0 && (
              <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full tabular-nums">
                {total}
              </span>
            )}
            {hasFilters && (
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                filtered
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {groups.length > 1 && (
              <button
                onClick={allCollapsed ? expandAll : collapseAll}
                className="text-[11px] text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {allCollapsed ? 'Expand all' : 'Collapse all'}
              </button>
            )}
            {activities.length > 0 && (
              <button
                onClick={() => exportCSV(displayed)}
                title="Export as CSV"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setShowFilters(v => !v)}
              title="Filters"
              className={`p-1.5 rounded-lg transition-colors ${
                showFilters || hasFilters ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRefresh}
              title="Refresh"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-3 p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by file name or user…"
              className="w-full pl-8 pr-7 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  category === cat.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* User filter with datalist autocomplete */}
          <div className="relative">
            <input
              type="text"
              list="activity-users-list"
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              placeholder="Filter by user…"
              className="w-full pl-3 pr-7 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
            />
            <datalist id="activity-users-list">
              {uniqueUsers.map(u => <option key={u} value={u} />)}
            </datalist>
            {userFilter && (
              <button onClick={() => setUserFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {hasFilters && (
            <button
              onClick={() => { setCategory('all'); setUserFilter(''); setSearch(''); }}
              className="text-[11px] text-blue-600 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Stats bar */}
      {activities.length > 4 && !showFilters && (
        <StatsBar activities={displayed} />
      )}

      {/* Groups */}
      <div>
        {groups.map(group => (
          <DateGroup key={group.label} group={group} onToggle={() => toggleGroup(group.label)} />
        ))}
      </div>

      {/* Load more */}
      {hasMore && !search && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-xl border border-gray-100 transition-all disabled:opacity-50"
        >
          {loadingMore
            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Loading…</>
            : <><ChevronDown className="w-3.5 h-3.5" />{total - activities.length} more</>
          }
        </button>
      )}
    </div>
  );
}