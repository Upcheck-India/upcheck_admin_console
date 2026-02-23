'use client';

import { useState, useEffect } from 'react';
import DataRoomNav from '../../components/dataroom/DataRoomNav';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Settings, 
  Database, 
  Users, 
  FileText, 
  Shield,
  HardDrive,
  Activity
} from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const [roomsRes, docsRes, usersRes, analyticsRes] = await Promise.all([
        fetch('/api/dataroom/rooms'),
        fetch('/api/dataroom/documents?limit=1'),
        fetch('/api/dataroom/user-groups'),
        fetch('/api/dataroom/analytics?timeRange=30d')
      ]);

      const rooms = roomsRes.ok ? await roomsRes.json() : { rooms: [] };
      const docs = docsRes.ok ? await docsRes.json() : { count: 0 };
      const users = usersRes.ok ? await usersRes.json() : { groups: [] };
      const analytics = analyticsRes.ok ? await analyticsRes.json() : { summary: {} };

      setStats({
        totalRooms: rooms.rooms?.length || 0,
        totalDocuments: docs.count || 0,
        totalGroups: users.groups?.length || 0,
        totalStorage: analytics.summary?.totalStorage || 0,
        activeUsers: analytics.users?.totalUsers || 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const adminCards = [
    {
      title: 'System Overview',
      icon: Activity,
      color: 'blue',
      stats: [
        { label: 'Total Rooms', value: stats?.totalRooms || 0 },
        { label: 'Total Documents', value: stats?.totalDocuments || 0 },
        { label: 'Active Users', value: stats?.activeUsers || 0 },
      ]
    },
    {
      title: 'Storage Management',
      icon: HardDrive,
      color: 'green',
      stats: [
        { label: 'Used Storage', value: `${((stats?.totalStorage || 0) / 1024 / 1024 / 1024).toFixed(2)} GB` },
        { label: 'Total Quota', value: '1000 GB' },
        { label: 'Available', value: '999 GB' },
      ]
    },
    {
      title: 'Security',
      icon: Shield,
      color: 'purple',
      stats: [
        { label: 'Cloudmersive Scanning', value: process.env.NEXT_PUBLIC_ENABLE_CLOUDMERSIVE === 'true' ? 'Enabled' : 'Disabled' },
        { label: 'Watermarking', value: 'Active' },
        { label: 'Audit Logs', value: 'Enabled' },
      ]
    },
  ];

  const quickActions = [
    { label: 'Create Room', path: '/dataroom/rooms/create', icon: FileText },
    { label: 'Manage Users', path: '/dataroom/admin/users', icon: Users },
    { label: 'View Analytics', path: '/dataroom/analytics', icon: Activity },
    { label: 'System Settings', path: '/dataroom/admin/settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DataRoomNav />
      <div className="flex-1 ml-64">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/dataroom')} className="p-2 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Data Room Administration</h1>
                <p className="text-sm text-slate-500">Manage system settings and configurations</p>
              </div>
            </div>
            <Settings className="w-6 h-6 text-slate-400" />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-600 mt-4">Loading admin dashboard...</p>
          </div>
        ) : (
          <>
            {/* System Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {adminCards.map((card, index) => (
                <div key={index} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`w-10 h-10 bg-${card.color}-100 rounded-lg flex items-center justify-center`}>
                      <card.icon className={`w-5 h-5 text-${card.color}-600`} />
                    </div>
                    <h3 className="font-semibold text-slate-900">{card.title}</h3>
                  </div>
                  <div className="space-y-3">
                    {card.stats.map((stat, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">{stat.label}</span>
                        <span className="text-sm font-medium text-slate-900">{stat.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
              <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => router.push(action.path)}
                    className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all"
                  >
                    <action.icon className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-900">{action.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* System Configuration */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">System Configuration</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">Cloudmersive Virus Scanning</p>
                    <p className="text-sm text-slate-500">Advanced threat detection for uploaded files</p>
                  </div>
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                    process.env.NEXT_PUBLIC_ENABLE_CLOUDMERSIVE === 'true' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {process.env.NEXT_PUBLIC_ENABLE_CLOUDMERSIVE === 'true' ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">Audit Logging</p>
                    <p className="text-sm text-slate-500">Track all user activity and changes</p>
                  </div>
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-700">
                    Enabled
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">Document Watermarking</p>
                    <p className="text-sm text-slate-500">Apply dynamic watermarks to protect documents</p>
                  </div>
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-700">
                    Active
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">Maximum File Size</p>
                    <p className="text-sm text-slate-500">Per-file upload limit</p>
                  </div>
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-700">
                    100 MB
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
