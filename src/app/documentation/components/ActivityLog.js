'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, FileText, Folder, Upload, Download, Edit2, Trash2,
  Copy, Move, Lock, Unlock, GitBranch, Clock, RefreshCw,
  ChevronDown, AlertCircle, User, Users
} from 'lucide-react';

// ─── Action config ────────────────────────────────────────────────────────────

const ACTION_CONFIG = {
  // File actions
  file_created:     { icon: FileText,  color: 'text-emerald-600',bg: 'bg-emerald-50', label: 'created file'               },
  file_uploaded:    { icon: Upload,    color: 'text-emerald-600',bg: 'bg-emerald-50', label: 'uploaded'                   },
  file_downloaded:  { icon: Download,  color: 'text-blue-600',   bg: 'bg-blue-50',    label: 'downloaded'                 },
  file_renamed:     { icon: Edit2,     color: 'text-amber-600',  bg: 'bg-amber-50',   label: 'renamed'                    },
  file_deleted:     { icon: Trash2,    color: 'text-red-500',    bg: 'bg-red-50',     label: 'deleted'                    },
  file_duplicated:  { icon: Copy,      color: 'text-indigo-600', bg: 'bg-indigo-50',  label: 'duplicated'                 },
  file_moved:       { icon: Move,      color: 'text-violet-600', bg: 'bg-violet-50',  label: 'moved'                      },
  file_updated:     { icon: Edit2,     color: 'text-blue-600',   bg: 'bg-blue-50',    label: 'updated'                    },

  // Folder actions
  folder_created:   { icon: Folder,    color: 'text-blue-600',   bg: 'bg-blue-50',    label: 'created folder'             },
  folder_renamed:   { icon: Edit2,     color: 'text-amber-600',  bg: 'bg-amber-50',   label: 'renamed folder'             },
  folder_deleted:   { icon: Trash2,    color: 'text-red-500',    bg: 'bg-red-50',     label: 'deleted folder'             },
  folder_moved:     { icon: Move,      color: 'text-violet-600', bg: 'bg-violet-50',  label: 'moved folder'               },
  folder_duplicate: { icon: Copy,      color: 'text-indigo-600', bg: 'bg-indigo-50',  label: 'duplicated folder'          },

  // Share actions
  share_link_created: { icon: Activity, color: 'text-pink-600', bg: 'bg-pink-50',     label: 'created share link for'     },
  share_link_updated: { icon: Edit2,    color: 'text-pink-600', bg: 'bg-pink-50',     label: 'updated share link for'     },
  share_link_deleted: { icon: Trash2,   color: 'text-red-500',  bg: 'bg-red-50',     label: 'deleted share link for'     },

  // Member actions
  member_add:       { icon: Users,     color: 'text-emerald-600',bg: 'bg-emerald-50', label: 'added member to'            },
  member_remove:    { icon: Users,     color: 'text-amber-600',  bg: 'bg-amber-50',   label: 'removed member from'        },
  member_role_change: { icon: Users,   color: 'text-blue-600',   bg: 'bg-blue-50',    label: 'changed role for'           },

  // Security actions
  password_added:   { icon: Lock,      color: 'text-amber-600',  bg: 'bg-amber-50',   label: 'added password to'          },
  password_removed: { icon: Unlock,    color: 'text-gray-500',   bg: 'bg-gray-100',   label: 'removed password from'      },

  // Version actions
  version_created:  { icon: GitBranch, color: 'text-teal-600',   bg: 'bg-teal-50',    label: 'uploaded new version of'    },
  version_reverted: { icon: RefreshCw, color: 'text-orange-600', bg: 'bg-orange-50',  label: 'reverted version of'        },

  // Project actions
  project_created:  { icon: Folder,    color: 'text-emerald-600',bg: 'bg-emerald-50', label: 'created project'            },
  project_updated:  { icon: Edit2,     color: 'text-blue-600',   bg: 'bg-blue-50',    label: 'updated project'            },
};

const FALLBACK_CONFIG = { icon: Activity, color: 'text-gray-500', bg: 'bg-gray-100', label: '' };

function getConfig(action) {
  return ACTION_CONFIG[action] || {
    ...FALLBACK_CONFIG,
    label: action?.replace(/_/g, ' ') || 'performed action',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTimeFull(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Returns initials (up to 2 chars) from a username */
function initials(name = '') {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

/** Stable hue from a string — keeps user avatars consistent */
function hue(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff;
  return h % 360;
}

/** Format bytes to human-readable size */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ─── Group activities by date ─────────────────────────────────────────────────

function groupByDate(activities) {
  const groups = [];
  let currentDate = null;

  activities.forEach(a => {
    const d = new Date(a.timestamp);
    const label = (() => {
      const now  = new Date();
      const diff = Math.floor((now - d) / 86400000);
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Yesterday';
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    })();

    if (label !== currentDate) {
      currentDate = label;
      groups.push({ label, items: [] });
    }
    groups[groups.length - 1].items.push(a);
  });

  return groups;
}

// ─── Activity row ─────────────────────────────────────────────────────────────

function ActivityRow({ activity, isLast }) {
  const cfg      = getConfig(activity.action);
  const Icon     = cfg.icon;
  const username = activity.user?.username || 'Unknown';
  const h        = hue(username);

  // Get the target name from various possible fields
  const targetName = activity.targetName || activity.resourceName || activity.details?.fileName || '';
  const targetType = activity.targetType || activity.resourceType || '';

  // Icon for target type
  const TargetIcon = targetType === 'folder' ? Folder : targetType === 'file' ? FileText : null;

  return (
    <div className={`relative flex gap-3 py-3 ${!isLast ? 'border-b border-gray-50' : ''}`}>
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${cfg.bg} shrink-0 z-10`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-100 mt-1" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-gray-800 leading-snug">
            {/* User avatar + name */}
            <span
              className="inline-flex items-center gap-1.5 mr-1"
            >
              <span
                className="inline-flex items-center justify-center w-4.5 h-4.5 w-[18px] h-[18px] rounded-full text-white text-[9px] font-bold shrink-0"
                style={{ background: `hsl(${h}, 55%, 55%)` }}
              >
                {initials(username)}
              </span>
              <span className="font-semibold text-gray-900">{username}</span>
            </span>
            <span className="text-gray-500">{cfg.label}</span>
            {targetName && (
              <>
                <span className="text-gray-400"> • </span>
                <span className="inline-flex items-center gap-1 font-medium text-gray-900">
                  {TargetIcon && <TargetIcon className="w-3 h-3 text-gray-400" />}
                  {targetName}
                </span>
              </>
            )}
          </p>

          {/* Relative time */}
          <time
            title={formatTimeFull(activity.timestamp)}
            className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap mt-0.5 cursor-default"
          >
            {formatTime(activity.timestamp)}
          </time>
        </div>

        {/* Secondary details */}
        {activity.details && (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {activity.details.path && (
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                <Folder className="w-2.5 h-2.5" />
                {activity.details.path}
              </span>
            )}
            {activity.details.folderId && (
              <span className="text-[11px] text-gray-400">
                Folder ID: {activity.details.folderId}
              </span>
            )}
            {activity.details.versionNumber && (
              <span className="text-[11px] text-teal-600 font-medium flex items-center gap-0.5">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                v{activity.details.versionNumber}
              </span>
            )}
            {activity.details.changeNote && (
              <span className="text-[11px] text-gray-500 italic">
                {activity.details.changeNote}
              </span>
            )}
            {activity.details.fileSize && (
              <span className="text-[11px] text-gray-400">
                {formatBytes(activity.details.fileSize)}
              </span>
            )}
            {activity.details.mimeType && (
              <span className="text-[11px] text-gray-400">
                {activity.details.mimeType}
              </span>
            )}
            {activity.details.oldName && activity.details.newName && (
              <span className="text-[11px] text-amber-600 font-medium">
                "{activity.details.oldName}" → "{activity.details.newName}"
              </span>
            )}
            {activity.metadata?.targetUser && (
              <span className="text-[11px] text-gray-500">
                User: {activity.metadata.targetUser}
              </span>
            )}
            {activity.metadata?.role && (
              <span className="text-[11px] text-gray-500">
                Role: {activity.metadata.role}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ActivityLog ─────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function ActivityLog({ projectId, limit = 10, showHeader = true }) {
  const [activities, setActivities] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore,setLoadingMore]= useState(false);
  const [error,      setError]      = useState(null);
  const [total,      setTotal]      = useState(0);
  const [offset,     setOffset]     = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-refresh every 60 s
  const intervalRef = useRef(null);

  const fetchActivities = useCallback(async ({ replace = true, off = 0 } = {}) => {
    if (!projectId) return;
    try {
      replace ? setLoading(true) : setLoadingMore(true);
      setError(null);

      const fetchLimit = replace ? limit : PAGE_SIZE;
      const res = await fetch(
        `/api/documentation/activity?projectId=${projectId}&limit=${fetchLimit}&offset=${off}`
      );
      if (!res.ok) throw new Error('Failed to load activity');
      const data = await res.json();
      const logs = data.logs || [];

      setActivities(prev => replace ? logs : [...prev, ...logs]);
      setTotal(data.total || 0);
      setOffset(off + logs.length);
    } catch (err) {
      setError('Could not load activity log.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [projectId, limit]);

  useEffect(() => {
    fetchActivities({ replace: true, off: 0 });
    intervalRef.current = setInterval(() => {
      fetchActivities({ replace: true, off: 0 });
    }, 60000);
    return () => clearInterval(intervalRef.current);
  }, [fetchActivities]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchActivities({ replace: true, off: 0 });
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleLoadMore = () => {
    fetchActivities({ replace: false, off: offset });
  };

  const groups   = groupByDate(activities);
  const hasMore  = activities.length < total;

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse px-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-3 items-start py-2">
            <div className="w-8 h-8 rounded-xl bg-gray-100 shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3.5 bg-gray-100 rounded-md w-4/5" />
              <div className="h-2.5 bg-gray-100 rounded-md w-2/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center py-8 text-center gap-2">
        <AlertCircle className="w-8 h-8 text-red-300" />
        <p className="text-sm text-gray-500">{error}</p>
        <button
          onClick={handleRefresh}
          className="text-xs text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
          <Activity className="w-5 h-5 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-600">No activity yet</p>
        <p className="text-xs text-gray-400 mt-1">Actions on this project will appear here.</p>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <div>
      {showHeader && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900">Activity</h3>
            {total > 0 && (
              <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                {total}
              </span>
            )}
          </div>
          <button
            onClick={handleRefresh}
            title="Refresh"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 transition-transform duration-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* Grouped activity list */}
      <div>
        {groups.map(group => (
          <div key={group.label} className="mb-4">
            {/* Date label */}
            <div className="flex items-center gap-2 mb-1 sticky top-0 bg-white/90 backdrop-blur-sm py-1 z-10">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                {group.label}
              </span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Rows */}
            <div>
              {group.items.map((activity, i) => (
                <ActivityRow
                  key={activity._id || i}
                  activity={activity}
                  isLast={i === group.items.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-xl border border-gray-100 transition-all disabled:opacity-50"
        >
          {loadingMore ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          {loadingMore ? 'Loading…' : `Load more  ·  ${total - activities.length} remaining`}
        </button>
      )}
    </div>
  );
}