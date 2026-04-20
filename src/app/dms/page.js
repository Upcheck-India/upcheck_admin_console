'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Database, ArrowRight, Shield, Users, BarChart3, Loader2 } from 'lucide-react';

export default function DMSHomePage() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [statsRes, activityRes] = await Promise.all([
        fetch('/api/dms/stats'),
        fetch('/api/dms/recent-activity')
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setRecentActivity(activityData.activities || []);
      }
    } catch (error) {
      console.error('Error fetching DMS data:', error);
    } finally {
      setLoading(false);
    }
  }

  const modules = [
    {
      title: 'Data Room',
      description: 'Secure virtual data room for confidential document sharing, due diligence, and M&A transactions',
      icon: Database,
      path: '/dataroom',
      color: 'blue',
      features: [
        'Secure Document Storage',
        'Permission Management',
        'Audit Trails',
        'Real-time Collaboration',
        'NDA Management',
        'Live Activity Tracking'
      ]
    },
    {
      title: 'Documentation',
      description: 'Comprehensive documentation management system for technical and business documents',
      icon: FileText,
      path: '/documentation',
      color: 'green',
      features: [
        'Version Control',
        'Markdown Support',
        'API Documentation',
        'Knowledge Base',
        'Search & Discovery',
        'Team Collaboration'
      ]
    }
  ];

  const statsConfig = [
        { 
      label: 'Data Room Files', 
      getValue: (data) => data?.dataroomDocuments?.toLocaleString() || '0',
      icon: Database, 
      color: 'blue' 
    },
    { 
      label: 'Documentation Files', 
      getValue: (data) => data?.documentationResources?.toLocaleString() || '0',
      icon: FileText, 
      color: 'green' 
    },
    { 
      label: 'Total Storage Used', 
      getValue: (data) => data?.storageUsed || '0 B',
      icon: Database, 
      color: 'purple' 
    },
    { 
      label: 'Total Active Users', 
      getValue: (data) => data?.activeUsers?.toLocaleString() || '0',
      icon: Users, 
      color: 'orange' 
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Database className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Document Management System</h1>
                <p className="text-sm text-slate-500 mt-1">Centralized hub for all your document needs</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Settings
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Quick Access
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {loading ? (
            statsConfig.map((_, index) => (
              <div key={`loading-${index}`} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="w-full">
                    <div className="h-4 bg-slate-200 rounded w-24 mb-2"></div>
                    <div className="h-8 bg-slate-200 rounded w-16"></div>
                  </div>
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex-shrink-0"></div>
                </div>
              </div>
            ))
          ) : (
            statsConfig.map((stat, index) => (
              <div key={`stat-${index}`} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-slate-900">{stat.getValue(stats)}</p>
                  </div>
                  <div className={`w-12 h-12 bg-${stat.color}-100 rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Main Modules */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Select a Module</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {modules.map((module, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-400 hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer"
                onClick={() => router.push(module.path)}
              >
                <div className={`h-2 bg-gradient-to-r ${
                  module.color === 'blue' 
                    ? 'from-blue-500 to-indigo-600' 
                    : 'from-green-500 to-emerald-600'
                }`}></div>
                
                <div className="p-8">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-16 h-16 bg-gradient-to-br ${
                      module.color === 'blue'
                        ? 'from-blue-500 to-indigo-600'
                        : 'from-green-500 to-emerald-600'
                    } rounded-2xl flex items-center justify-center shadow-lg`}>
                      <module.icon className="w-8 h-8 text-white" />
                    </div>
                    <ArrowRight className="w-6 h-6 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>

                  <h3 className="text-2xl font-bold text-slate-900 mb-3">{module.title}</h3>
                  <p className="text-slate-600 mb-6 leading-relaxed">{module.description}</p>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-700 mb-3">Key Features:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {module.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            module.color === 'blue' ? 'bg-blue-600' : 'bg-green-600'
                          }`}></div>
                          <span className="text-sm text-slate-600">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    className={`mt-6 w-full py-3 px-6 bg-gradient-to-r ${
                      module.color === 'blue'
                        ? 'from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                        : 'from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                    } text-white rounded-xl font-semibold flex items-center justify-center space-x-2 transition-all shadow-lg hover:shadow-xl`}
                  >
                    <span>Open {module.title}</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
            <button className="text-sm text-blue-600 hover:underline">View All</button>
          </div>
          <div className="space-y-3">
            {[
              { action: 'Document uploaded', module: 'Data Room', time: '5 minutes ago', user: 'John Doe' },
              { action: 'New documentation created', module: 'Documentation', time: '15 minutes ago', user: 'Jane Smith' },
              { action: 'Permission granted', module: 'Data Room', time: '1 hour ago', user: 'Admin' },
              { action: 'Version updated', module: 'Documentation', time: '2 hours ago', user: 'Bob Wilson' },
            ].map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{activity.action}</p>
                    <p className="text-xs text-slate-500">{activity.module} • {activity.user}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-400">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
