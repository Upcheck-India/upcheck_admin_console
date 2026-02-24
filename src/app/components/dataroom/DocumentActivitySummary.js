'use client';

import { useEffect, useState } from 'react';
import { Eye, Download, Users, Clock, MapPin, Monitor } from 'lucide-react';

export default function DocumentActivitySummary({ documentId }) {
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (documentId) {
      fetchActivity();
    }
  }, [documentId]);

  async function fetchActivity() {
    try {
      const response = await fetch(`/api/dataroom/documents/${documentId}/activity`);
      if (response.ok) {
        const data = await response.json();
        setActivity(data);
      }
    } catch (error) {
      console.error('Failed to fetch document activity:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(seconds) {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          <div className="h-3 bg-slate-200 rounded w-3/4"></div>
          <div className="h-3 bg-slate-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!activity) return null;

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
          <div className="flex items-center space-x-2 mb-1">
            <Eye className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-900">Total Views</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{activity.totalViews || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
          <div className="flex items-center space-x-2 mb-1">
            <Download className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-green-900">Downloads</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{activity.totalDownloads || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
          <div className="flex items-center space-x-2 mb-1">
            <Users className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium text-purple-900">Unique Users</span>
          </div>
          <p className="text-2xl font-bold text-purple-700">{activity.uniqueUsers || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
          <div className="flex items-center space-x-2 mb-1">
            <Clock className="w-4 h-4 text-orange-600" />
            <span className="text-xs font-medium text-orange-900">Avg Time</span>
          </div>
          <p className="text-2xl font-bold text-orange-700">
            {formatDuration(activity.avgViewDuration || 0)}
          </p>
        </div>
      </div>

      {/* Recent Viewers */}
      {activity.recentViewers && activity.recentViewers.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Recent Viewers</span>
          </h4>
          <div className="space-y-2">
            {activity.recentViewers.slice(0, 5).map((viewer, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-xs">
                      {viewer.userName?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{viewer.userName}</p>
                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      {viewer.device && (
                        <div className="flex items-center space-x-1">
                          <Monitor className="w-3 h-3" />
                          <span>{viewer.device.type}</span>
                        </div>
                      )}
                      {viewer.location && (
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3" />
                          <span>{viewer.location.city}, {viewer.location.country}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">
                    {viewer.lastViewed ? new Date(viewer.lastViewed).toLocaleDateString() : 'Recently'}
                  </p>
                  {viewer.viewDuration && (
                    <p className="text-xs font-medium text-slate-700">
                      {formatDuration(viewer.viewDuration)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Locations */}
      {activity.topLocations && activity.topLocations.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center space-x-2">
            <MapPin className="w-4 h-4" />
            <span>Top Locations</span>
          </h4>
          <div className="space-y-2">
            {activity.topLocations.slice(0, 5).map((location, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-slate-700">{location.city}, {location.country}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${(location.count / activity.totalViews) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-slate-600 w-8 text-right">{location.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
