'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import SecureLoading from '../../components/SecureLoading';
import DataRoomNav from '../../components/dataroom/DataRoomNav';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  TrendingUp,
  Users,
  FileText,
  Eye,
  Download,
  Clock,
  BarChart3,
  Activity
} from 'lucide-react';

export default function AnalyticsPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
    fetchAuditLogs();
  }, [timeRange]);

  if (authLoading) {
    return <SecureLoading />;
  }

  if (!isAuthenticated) {
    return null;
  }

  async function fetchAnalytics() {
    try {
      const response = await fetch(`/api/dataroom/analytics?timeRange=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAuditLogs() {
    try {
      const response = await fetch(`/api/dataroom/audit?limit=20&timeRange=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    }
  }

  function formatDate(date) {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  const stats = [
    {
      label: 'Total Documents',
      value: analytics?.summary?.totalDocuments || 0,
      change: '+12%',
      icon: FileText,
      color: 'blue'
    },
    {
      label: 'Total Views',
      value: analytics?.summary?.totalViews || 0,
      change: '+24%',
      icon: Eye,
      color: 'green'
    },
    {
      label: 'Total Downloads',
      value: analytics?.summary?.totalDownloads || 0,
      change: '+8%',
      icon: Download,
      color: 'purple'
    },
    {
      label: 'Active Users',
      value: analytics?.users?.totalUsers || 0,
      change: '+5%',
      icon: Users,
      color: 'orange'
    },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DataRoomNav />
      <div className="flex-1 ml-64">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dataroom')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Analytics & Reports</h1>
                <p className="text-sm text-slate-500">Monitor activity and engagement</p>
              </div>
            </div>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-600 mt-4">Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-12 h-12 bg-${stat.color}-100 rounded-lg flex items-center justify-center`}>
                      <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                    </div>
                    <span className="text-green-600 text-sm font-medium">{stat.change}</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-900">{stat.value.toLocaleString()}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top Documents */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Top Documents</h3>
                  <BarChart3 className="w-5 h-5 text-slate-400" />
                </div>
                <div className="space-y-3">
                  {analytics?.engagement?.slice(0, 5).map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{doc.documentName}</p>
                        <p className="text-xs text-slate-500">Room: {doc.roomName || 'N/A'}</p>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center text-slate-600">
                          <Eye className="w-4 h-4 mr-1" />
                          <span>{doc.views}</span>
                        </div>
                        <div className="flex items-center text-slate-600">
                          <Download className="w-4 h-4 mr-1" />
                          <span>{doc.downloads}</span>
                        </div>
                      </div>
                    </div>
                  )) || (
                    <p className="text-center text-slate-500 py-8">No document activity</p>
                  )}
                </div>
              </div>

              {/* Active Users */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Active Users</h3>
                  <Users className="w-5 h-5 text-slate-400" />
                </div>
                <div className="space-y-3">
                  {analytics?.users?.activeUsers?.slice(0, 5).map((user, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {user.email?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{user.email}</p>
                          <p className="text-xs text-slate-500">{user.actionCount} actions</p>
                        </div>
                      </div>
                    </div>
                  )) || (
                    <p className="text-center text-slate-500 py-8">No user activity</p>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
                <Activity className="w-5 h-5 text-slate-400" />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Action</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">User</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Resource</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {auditLogs.length > 0 ? (
                      auditLogs.map((log) => (
                        <tr key={log._id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-900">{log.userEmail}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{log.resourceType}</td>
                          <td className="py-3 px-4 text-sm text-slate-500">
                            <div className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatDate(log.timestamp)}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-slate-500">
                          No recent activity
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export Button */}
            <div className="mt-6 flex justify-end">
              <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Export Report (CSV)
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
