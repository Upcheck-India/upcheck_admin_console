'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity, Search, Filter, ArrowLeft, ExternalLink, Calendar,
  FileText, Folder, Users, Share2, Trash2, Edit2, Copy, Move,
  Lock, Unlock, Download, Eye, User, Clock, AlertCircle
} from 'lucide-react';

const ACTION_CONFIG = {
  // File actions
  file_upload: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', label: 'File Uploaded' },
  file_rename: { icon: Edit2, color: 'text-purple-600', bg: 'bg-purple-50', label: 'File Renamed' },
  file_duplicate: { icon: Copy, color: 'text-cyan-600', bg: 'bg-cyan-50', label: 'File Duplicated' },
  file_move: { icon: Move, color: 'text-amber-600', bg: 'bg-amber-50', label: 'File Moved' },
  file_delete: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-50', label: 'File Deleted' },
  download: { icon: Download, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'File Downloaded' },

  // Folder actions
  folder_created: { icon: Folder, color: 'text-violet-600', bg: 'bg-violet-50', label: 'Folder Created' },
  folder_renamed: { icon: Edit2, color: 'text-violet-600', bg: 'bg-violet-50', label: 'Folder Renamed' },
  folder_deleted: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-50', label: 'Folder Deleted' },
  folder_duplicate: { icon: Copy, color: 'text-violet-600', bg: 'bg-violet-50', label: 'Folder Duplicated' },

  // Share actions
  share_create: { icon: Share2, color: 'text-pink-600', bg: 'bg-pink-50', label: 'Share Link Created' },
  share_update: { icon: Edit2, color: 'text-pink-600', bg: 'bg-pink-50', label: 'Share Link Updated' },
  share_delete: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-50', label: 'Share Link Deleted' },

  // Member actions
  member_add: { icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Member Added' },
  member_remove: { icon: Users, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Member Removed' },
  member_role_change: { icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Role Changed' },

  // Project actions
  project_create: { icon: Folder, color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Project Created' },
  project_update: { icon: Edit2, color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Project Updated' },
  project_delete: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-50', label: 'Project Deleted' },
  project_archive: { icon: Calendar, color: 'text-slate-600', bg: 'bg-slate-50', label: 'Project Archived' },
  project_unarchive: { icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Project Restored' },
  project_duplicate: { icon: Copy, color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Project Duplicated' },

  // Version actions
  version_create: { icon: Copy, color: 'text-teal-600', bg: 'bg-teal-50', label: 'Version Created' },
  version_revert: { icon: Clock, color: 'text-teal-600', bg: 'bg-teal-50', label: 'Version Reverted' },

  // Security actions
  password_add: { icon: Lock, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Password Added' },
  password_remove: { icon: Unlock, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Password Removed' },
};

export default function AllActivityLogPage() {
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, files, folders, shares, members, projects
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest
  const [dateRange, setDateRange] = useState('all'); // all, today, week, month

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/documentation/activity');
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      } else {
        setError('Failed to load activity logs');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort logs
  const filteredLogs = logs.filter(log => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const resourceName = log.resourceName?.toLowerCase() || '';
      const username = log.user?.username?.toLowerCase() || log.username?.toLowerCase() || '';
      const action = log.action?.toLowerCase() || '';
      if (!resourceName.includes(query) && !username.includes(query) && !action.includes(query)) {
        return false;
      }
    }

    // Category filter
    if (filter !== 'all') {
      const categoryMap = {
        files: ['file_upload', 'file_rename', 'file_duplicate', 'file_move', 'file_delete', 'download'],
        folders: ['folder_created', 'folder_renamed', 'folder_deleted', 'folder_duplicate'],
        shares: ['share_create', 'share_update', 'share_delete'],
        members: ['member_add', 'member_remove', 'member_role_change'],
        projects: ['project_create', 'project_update', 'project_delete', 'project_archive', 'project_unarchive', 'project_duplicate'],
      };
      if (!categoryMap[filter]?.includes(log.action)) {
        return false;
      }
    }

    // Date range filter
    if (dateRange !== 'all') {
      const logDate = new Date(log.timestamp);
      const now = new Date();
      const diffMs = now - logDate;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      switch (dateRange) {
        case 'today':
          return diffDays <= 1;
        case 'week':
          return diffDays <= 7;
        case 'month':
          return diffDays <= 30;
        default:
          return true;
      }
    }

    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.timestamp) - new Date(a.timestamp);
      case 'oldest':
        return new Date(a.timestamp) - new Date(b.timestamp);
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading activity logs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/documentation')}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/documentation')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Activity Log</h1>
                <p className="text-sm text-gray-500">Track all actions across your documentation</p>
              </div>
            </div>
            <Link
              href="/documentation"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Documentation
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, user, or action..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <AlertCircle className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
              >
                <option value="all">All Actions</option>
                <option value="files">Files</option>
                <option value="folders">Folders</option>
                <option value="shares">Share Links</option>
                <option value="members">Members</option>
                <option value="projects">Projects</option>
              </select>
            </div>

            {/* Date Range */}
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Activity Timeline */}
        {filteredLogs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No Activity Found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || filter !== 'all' ? 'Try adjusting your search or filter' : 'No activity has been recorded yet'}
            </p>
            <Link
              href="/documentation"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
            >
              Browse Projects
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {filteredLogs.map((log, index) => {
                const actionConfig = ACTION_CONFIG[log.action] || {
                  icon: Activity,
                  color: 'text-gray-600',
                  bg: 'bg-gray-50',
                  label: log.action
                };
                const Icon = actionConfig.icon;

                return (
                  <div
                    key={log._id || index}
                    className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4"
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl ${actionConfig.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-5 h-5 ${actionConfig.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">{log.user?.username || log.username || 'Unknown'}</span>
                            <span className="text-gray-400">•</span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${actionConfig.bg} ${actionConfig.color}`}>
                              {actionConfig.label}
                            </span>
                            {(log.targetName || log.resourceName) && (
                              <>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-700 truncate max-w-xs">{log.targetName || log.resourceName}</span>
                              </>
                            )}
                          </div>

                          {/* Details */}
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            {log.details?.fileSize && (
                              <span className="text-xs text-gray-500">{formatBytes(log.details.fileSize)}</span>
                            )}
                            {log.details?.versionNumber && (
                              <span className="text-xs text-teal-600 font-medium">v{log.details.versionNumber}</span>
                            )}
                            {log.details?.changeNote && (
                              <span className="text-xs text-gray-500 italic">{log.details.changeNote}</span>
                            )}
                            {log.details?.oldName && log.details?.newName && (
                              <span className="text-xs text-amber-600">"{log.details.oldName}" → "{log.details.newName}"</span>
                            )}
                          </div>

                          {/* Metadata */}
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-2">
                              {log.metadata.targetUser && (
                                <span>User: {log.metadata.targetUser}</span>
                              )}
                              {log.metadata.role && (
                                <span>Role: {log.metadata.role}</span>
                              )}
                              {log.metadata.targetEmail && (
                                <span>Email: {log.metadata.targetEmail}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1.5 text-sm text-gray-500">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTimeAgo(new Date(log.timestamp))}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {new Date(log.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
          <p>Showing {filteredLogs.length} of {logs.length} activity logs</p>
        </div>
      </main>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
