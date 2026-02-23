'use client';

import { useState, useEffect } from 'react';
import { Activity, Eye, User, FileText, RefreshCw } from 'lucide-react';
import DataRoomNav from '../../components/dataroom/DataRoomNav';

export default function LiveActivityPage() {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [roomFilter, setRoomFilter] = useState('');

  useEffect(() => {
    fetchActivity();
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchActivity();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh, roomFilter]);

  async function fetchActivity() {
    try {
      const params = new URLSearchParams();
      if (roomFilter) params.append('roomId', roomFilter);

      const response = await fetch(`/api/dataroom/activity/live?${params}`);
      if (response.ok) {
        const data = await response.json();
        setActivity(data.activity || []);
        setLastUpdate(new Date(data.asOf));
      }
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(date) {
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 1000); // seconds

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DataRoomNav />
      
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-3">
                  <Activity className="w-7 h-7 text-blue-600" />
                  <span>Live Activity Monitor</span>
                </h1>
                <p className="text-sm text-slate-500 mt-1">Real-time monitoring of active users and document views</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
                  <span className="text-sm text-slate-600">
                    {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
                  </span>
                </div>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    autoRefresh
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {autoRefresh ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={fetchActivity}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  title="Refresh Now"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Stats */}
        <div className="px-8 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Active Users</p>
                <p className="text-3xl font-bold text-slate-900">{activity.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Documents Being Viewed</p>
                <p className="text-3xl font-bold text-slate-900">
                  {activity.reduce((sum, user) => sum + user.viewing.length, 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Eye className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Last Updated</p>
                <p className="text-lg font-semibold text-slate-900">{formatTime(lastUpdate)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Activity List */}
        <div className="px-8 py-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-600 mt-4">Loading activity...</p>
            </div>
          ) : activity.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No Active Users</h3>
              <p className="text-slate-500">No one is currently viewing documents</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activity.map((user, index) => (
                <div key={index} className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{user.userName}</h3>
                        <p className="text-sm text-slate-500">{user.userEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        user.isExternal
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {user.isExternal ? 'External User' : 'Upcheck Staff'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatTime(user.lastActivity)}
                      </span>
                    </div>
                  </div>

                  {/* Documents Being Viewed */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700 flex items-center space-x-2">
                      <Eye className="w-4 h-4" />
                      <span>Currently Viewing ({user.viewing.length})</span>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {user.viewing.map((doc, docIndex) => (
                        <div
                          key={docIndex}
                          className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {doc.documentName}
                            </p>
                            <p className="text-xs text-slate-500">
                              Viewed {formatTime(doc.viewedAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
