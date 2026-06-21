'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Search, Filter, Calendar, RefreshCw, MessageSquare, Plus, 
  Users, Folder, ArrowRight, CheckSquare, Loader2, Info, UserPlus, 
  Archive, Copy, KeyRound, Edit
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import useOnlineUsers from '../../../hooks/useOnlineUsers';
import AvatarWithStatus from '../../../components/AvatarWithStatus';

export default function ProjectActivityPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const onlineUsers = useOnlineUsers();
  const onlineUsernames = useMemo(() => new Set(onlineUsers.map(u => u.username)), [onlineUsers]);

  const [logs, setLogs] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState('All');
  const [selectedType, setSelectedType] = useState('All'); // All, Project, Task
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects/activity');
      if (!res.ok) {
        throw new Error('Failed to fetch activity logs');
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setProjectsList(data.projects || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Format relative time (e.g. "3 hours ago")
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Project filter
      if (selectedProjectId !== 'All' && log.projectId !== selectedProjectId) {
        return false;
      }

      // Type filter
      if (selectedType !== 'All') {
        if (selectedType === 'Project' && log.type !== 'project') return false;
        if (selectedType === 'Task' && log.type !== 'task') return false;
      }

      // Search term (searches user, task title, action, project name)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesUser = log.userName?.toLowerCase().includes(term);
        const matchesProject = log.projectName?.toLowerCase().includes(term);
        const matchesAction = log.action?.toLowerCase().includes(term);
        const matchesTask = log.taskTitle?.toLowerCase().includes(term);
        const matchesComment = log.details?.comment?.toLowerCase().includes(term) || log.details?.content?.toLowerCase().includes(term);
        
        return matchesUser || matchesProject || matchesAction || matchesTask || matchesComment;
      }

      return true;
    });
  }, [logs, selectedProjectId, selectedType, searchTerm]);

  // Render log item helper
  const renderLogDescription = (log) => {
    const boldText = "font-semibold text-gray-900 hover:underline cursor-pointer";
    
    const handleProjectClick = () => {
      router.push(`/project_management/${log.projectId}`);
    };

    if (log.type === 'project') {
      switch (log.action) {
        case 'CREATE_PROJECT':
          return (
            <span>
              created project <span className={boldText} onClick={handleProjectClick}>{log.projectName}</span>
            </span>
          );
        case 'ARCHIVE_PROJECT':
          return (
            <span>
              archived project <span className={boldText} onClick={handleProjectClick}>{log.projectName}</span>
            </span>
          );
        case 'UNARCHIVE_PROJECT':
          return (
            <span>
              restored project <span className={boldText} onClick={handleProjectClick}>{log.projectName}</span>
            </span>
          );
        case 'DUPLICATE_PROJECT':
          return (
            <span>
              duplicated project <span className={boldText} onClick={handleProjectClick}>{log.projectName}</span>
            </span>
          );
        case 'ADD_PROJECT_MEMBER':
          return (
            <span>
              added <span className="font-semibold text-blue-600">{log.targetUser}</span> as <span className="text-gray-600 font-medium">{log.role}</span> to <span className={boldText} onClick={handleProjectClick}>{log.projectName}</span>
            </span>
          );
        case 'REMOVE_PROJECT_MEMBER':
          return (
            <span>
              removed member <span className="font-semibold text-red-600">{log.targetUser}</span> from <span className={boldText} onClick={handleProjectClick}>{log.projectName}</span>
            </span>
          );
        case 'UPDATE_PROJECT_ROLE':
          return (
            <span>
              updated role for <span className="font-semibold text-gray-700">{log.targetUser}</span> to <span className="font-medium text-gray-600">{log.role}</span> in <span className={boldText} onClick={handleProjectClick}>{log.projectName}</span>
            </span>
          );
        case 'UPDATE_PROJECT_PERMISSIONS':
          return (
            <span>
              updated access permissions for <span className={boldText} onClick={handleProjectClick}>{log.projectName}</span>
            </span>
          );
        default:
          return (
            <span>
              modified project <span className={boldText} onClick={handleProjectClick}>{log.projectName}</span> ({log.action.replace('_', ' ').toLowerCase()})
            </span>
          );
      }
    } else {
      // Task Log
      switch (log.action) {
        case 'MOVE_TASK': {
          const statusChange = log.details?.changes?.find(c => c.field === 'status');
          const fromVal = statusChange?.from || 'Backlog';
          const toVal = statusChange?.to || 'Done';
          return (
            <span>
              moved task <span className="font-semibold text-gray-800">{log.taskTitle}</span> from <span className="text-gray-500 font-medium">{fromVal}</span> to <span className="text-blue-600 font-semibold">{toVal}</span> in <span className={boldText} onClick={handleProjectClick}>{log.projectName}</span>
            </span>
          );
        }
        case 'COMMENT_TASK': {
          const commentText = log.details?.comment || log.details?.content || '';
          return (
            <span>
              commented on task <span className="font-semibold text-gray-800">{log.taskTitle}</span> in <span className={boldText} onClick={handleProjectClick}>{log.projectName}</span>:
              <span className="block mt-1 text-sm bg-gray-50 border border-gray-150 p-2.5 rounded-lg text-gray-600 italic font-mono max-w-xl">
                &quot;{commentText}&quot;
              </span>
            </span>
          );
        }
        case 'UPDATE_TASK':
        default: {
          const changes = log.details?.changes || [];
          if (changes.length > 0) {
            const fieldsChanged = changes.map(c => c.field).join(', ');
            return (
              <span>
                updated <span className="font-semibold text-gray-700">{fieldsChanged}</span> on task <span className="font-semibold text-gray-800">{log.taskTitle}</span> in <span className={boldText} onClick={handleProjectClick}>{log.projectName}</span>
              </span>
            );
          }
          return (
            <span>
              updated task <span className="font-semibold text-gray-800">{log.taskTitle}</span> in <span className={boldText} onClick={handleProjectClick}>{log.projectName}</span>
            </span>
          );
        }
      }
    }
  };

  // Get action icons and colors
  const getLogIcon = (log) => {
    const iconClass = "w-4 h-4";
    if (log.type === 'project') {
      switch (log.action) {
        case 'CREATE_PROJECT':
          return {
            bg: 'bg-emerald-50 border-emerald-100 text-emerald-600',
            icon: <Plus className={iconClass} />
          };
        case 'ARCHIVE_PROJECT':
          return {
            bg: 'bg-red-50 border-red-100 text-red-600',
            icon: <Archive className={iconClass} />
          };
        case 'UNARCHIVE_PROJECT':
          return {
            bg: 'bg-blue-50 border-blue-100 text-blue-600',
            icon: <Folder className={iconClass} />
          };
        case 'ADD_PROJECT_MEMBER':
        case 'UPDATE_PROJECT_ROLE':
          return {
            bg: 'bg-indigo-50 border-indigo-100 text-indigo-600',
            icon: <UserPlus className={iconClass} />
          };
        case 'UPDATE_PROJECT_PERMISSIONS':
          return {
            bg: 'bg-purple-50 border-purple-100 text-purple-600',
            icon: <KeyRound className={iconClass} />
          };
        default:
          return {
            bg: 'bg-gray-50 border-gray-150 text-gray-600',
            icon: <Edit className={iconClass} />
          };
      }
    } else {
      switch (log.action) {
        case 'MOVE_TASK':
          return {
            bg: 'bg-sky-50 border-sky-100 text-sky-600',
            icon: <ArrowRight className={iconClass} />
          };
        case 'COMMENT_TASK':
          return {
            bg: 'bg-amber-50 border-amber-100 text-amber-600',
            icon: <MessageSquare className={iconClass} />
          };
        default:
          return {
            bg: 'bg-blue-50 border-blue-100 text-blue-500',
            icon: <CheckSquare className={iconClass} />
          };
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Ocean Blue Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-teal-500 pt-6 pb-12 px-4 md:px-6 relative overflow-hidden">
        {/* Decorative background shapes */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-white opacity-5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-60 h-60 bg-teal-300 opacity-10 rounded-full blur-2xl"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          <button
            onClick={() => router.push('/project_management')}
            className="flex items-center text-sm text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </button>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                <RefreshCw className="h-7 w-7 animate-spin-slow" /> Project Activity Feed
              </h1>
              <p className="text-blue-100 text-sm mt-1 max-w-2xl">
                Monitor updates, task drag-and-drops, member management, and comments across all active projects.
              </p>
            </div>
            
            <button 
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-medium text-sm px-4 py-2 rounded-lg border border-white/20 transition-all self-start md:self-center"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 mt-6">
        {/* Filters Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search user, task, project..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all outline-none"
              />
            </div>

            {/* Project Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:inline">Project:</span>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all"
              >
                <option value="All">All Projects</option>
                {projectsList.map(proj => (
                  <option key={proj.id} value={proj.id}>{proj.name}</option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:inline">Type:</span>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all"
              >
                <option value="All">All Activities</option>
                <option value="Project">Projects Only</option>
                <option value="Task">Tasks Only</option>
              </select>
            </div>

            {/* Summary Count */}
            <div className="flex items-center justify-end text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-700 px-1">{filteredLogs.length}</span> entries
            </div>
          </div>
        </div>

        {/* Timeline Logs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-6 md:p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
              <p className="text-sm font-medium">Loading project activities...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-red-500 max-w-md mx-auto">
              <Info className="h-12 w-12 mb-3" />
              <h3 className="font-semibold text-lg text-red-700">Error Fetching Logs</h3>
              <p className="text-sm text-gray-500 mt-1 mb-6">{error}</p>
              <button 
                onClick={fetchData}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded-lg transition-colors shadow-sm"
              >
                Retry
              </button>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-20 text-gray-500 max-w-sm mx-auto">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-800">No Activity Found</h3>
              <p className="text-sm text-gray-500 mt-1">
                {searchTerm || selectedProjectId !== 'All' || selectedType !== 'All' 
                  ? 'No records match your filters. Try clearing them.'
                  : 'No updates or activities have been logged yet.'}
              </p>
              {(searchTerm || selectedProjectId !== 'All' || selectedType !== 'All') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedProjectId('All');
                    setSelectedType('All');
                  }}
                  className="mt-4 px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="relative border-l border-gray-200 ml-4 md:ml-6 pl-6 md:pl-8 space-y-8">
              {filteredLogs.map((log) => {
                const badgeInfo = getLogIcon(log);
                const isOnline = onlineUsernames.has(log.userName);
                
                return (
                  <div key={log.id} className="relative group">
                    {/* Floating Icon Circle */}
                    <div className={`absolute -left-[45px] md:-left-[53px] top-0.5 rounded-full border-2 border-white w-9 h-9 flex items-center justify-center shadow-sm z-10 transition-transform group-hover:scale-105 ${badgeInfo.bg}`}>
                      {badgeInfo.icon}
                    </div>

                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      {/* Avatar */}
                      <div className="flex-shrink-0 mt-0.5">
                        <AvatarWithStatus 
                          username={log.userName} 
                          online={isOnline}
                          className="h-9 w-9 text-sm" 
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-grow min-w-0">
                        <div className="text-sm text-gray-600">
                          {/* User name & status indicator */}
                          <span className="font-bold text-gray-900 mr-1 flex-inline items-center gap-1">
                            {log.userName}
                          </span>
                          
                          {/* Activity Description */}
                          {renderLogDescription(log)}
                        </div>
                        
                        {/* Time Metadata */}
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                          <span>{formatRelativeTime(log.timestamp)}</span>
                          <span>•</span>
                          <span className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-0.5 rounded cursor-pointer transition-colors font-medium" onClick={() => router.push(`/project_management/${log.projectId}`)}>
                            {log.projectName}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
