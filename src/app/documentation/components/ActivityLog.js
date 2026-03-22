'use client';

import React, { useState, useEffect } from 'react';
import { 
  Activity, FileText, Folder, Upload, Download, Edit2, Trash2, 
  Copy, Move, Lock, Unlock, GitBranch, Clock, User, RefreshCw
} from 'lucide-react';

const ACTION_CONFIG = {
  folder_created: { icon: Folder, color: 'text-blue-600 bg-blue-100', label: 'Created folder' },
  folder_renamed: { icon: Edit2, color: 'text-amber-600 bg-amber-100', label: 'Renamed folder' },
  folder_deleted: { icon: Trash2, color: 'text-red-600 bg-red-100', label: 'Deleted folder' },
  folder_moved: { icon: Move, color: 'text-purple-600 bg-purple-100', label: 'Moved folder' },
  file_uploaded: { icon: Upload, color: 'text-green-600 bg-green-100', label: 'Uploaded file' },
  file_downloaded: { icon: Download, color: 'text-blue-600 bg-blue-100', label: 'Downloaded file' },
  file_renamed: { icon: Edit2, color: 'text-amber-600 bg-amber-100', label: 'Renamed file' },
  file_deleted: { icon: Trash2, color: 'text-red-600 bg-red-100', label: 'Deleted file' },
  file_duplicated: { icon: Copy, color: 'text-indigo-600 bg-indigo-100', label: 'Duplicated file' },
  file_moved: { icon: Move, color: 'text-purple-600 bg-purple-100', label: 'Moved file' },
  password_added: { icon: Lock, color: 'text-amber-600 bg-amber-100', label: 'Added password protection' },
  password_removed: { icon: Unlock, color: 'text-gray-600 bg-gray-100', label: 'Removed password protection' },
  version_created: { icon: GitBranch, color: 'text-teal-600 bg-teal-100', label: 'Created new version' },
  version_reverted: { icon: RefreshCw, color: 'text-orange-600 bg-orange-100', label: 'Reverted to version' },
  project_created: { icon: Folder, color: 'text-green-600 bg-green-100', label: 'Created project' },
  project_updated: { icon: Edit2, color: 'text-blue-600 bg-blue-100', label: 'Updated project' },
};

export default function ActivityLog({ projectId, limit = 10, showHeader = true }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, [projectId, showAll]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const actualLimit = showAll ? 50 : limit;
      const response = await fetch(`/api/documentation/activity?projectId=${projectId}&limit=${actualLimit}`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getActionConfig = (action) => {
    return ACTION_CONFIG[action] || { 
      icon: Activity, 
      color: 'text-gray-600 bg-gray-100', 
      label: action.replace(/_/g, ' ') 
    };
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-gray-200"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Activity className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Recent Activity
          </h3>
          {total > limit && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View all ({total})
            </button>
          )}
        </div>
      )}

      <div className="space-y-1">
        {activities.map((activity, index) => {
          const config = getActionConfig(activity.action);
          const Icon = config.icon;

          return (
            <div 
              key={activity._id || index}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {/* Icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}>
                <Icon className="w-4 h-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{activity.user?.username || 'Unknown'}</span>
                  {' '}
                  <span className="text-gray-600">{config.label}</span>
                  {activity.targetName && (
                    <>
                      {' '}
                      <span className="font-medium text-gray-900">"{activity.targetName}"</span>
                    </>
                  )}
                </p>
                
                {/* Details */}
                {activity.details && Object.keys(activity.details).length > 0 && (
                  <div className="mt-0.5 text-xs text-gray-500">
                    {activity.details.path && <span>in {activity.details.path}</span>}
                    {activity.details.versionNumber && <span>Version {activity.details.versionNumber}</span>}
                    {activity.details.changeNote && <span>• {activity.details.changeNote}</span>}
                  </div>
                )}

                {/* Time */}
                <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {formatTime(activity.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showAll && activities.length < total && (
        <button
          onClick={() => {/* TODO: Load more */}}
          className="w-full mt-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Load more...
        </button>
      )}
    </div>
  );
}
