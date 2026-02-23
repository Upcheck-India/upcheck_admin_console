'use client';

import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, 
  Folder, 
  BarChart3, 
  MessageSquare, 
  CheckSquare, 
  GitBranch, 
  Users, 
  Shield, 
  Settings, 
  FileText,
  Activity,
  Bell,
  User,
  Search
} from 'lucide-react';
import { useState } from 'react';

export default function DataRoomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { label: 'Dashboard', icon: Home, path: '/dataroom', badge: null },
    { label: 'Analytics', icon: BarChart3, path: '/dataroom/analytics', badge: null },
    { label: 'Q&A', icon: MessageSquare, path: '/dataroom/qa', badge: null },
    { label: 'Tasks', icon: CheckSquare, path: '/dataroom/tasks', badge: null },
    { label: 'Workflows', icon: GitBranch, path: '/dataroom/workflows', badge: null },
    { label: 'Users', icon: Users, path: '/dataroom/users', badge: null },
    { label: 'Permissions', icon: Shield, path: '/dataroom/permissions', badge: null },
    { label: 'Live Activity', icon: Activity, path: '/dataroom/activity', badge: null },
    { label: 'Audit Logs', icon: FileText, path: '/dataroom/audit', badge: null },
    { label: 'Admin', icon: Settings, path: '/dataroom/admin', badge: null },
  ];

  function isActive(path) {
    if (path === '/dataroom') {
      return pathname === path;
    }
    return pathname.startsWith(path);
  }

  return (
    <nav className={`fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-50 ${
      collapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Folder className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg">Data Room</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-slate-800 rounded"
          >
            <svg className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="py-4 px-2 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive(item.path)
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title={collapsed ? item.label : ''}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </div>

      {/* User Section */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
        <button
          onClick={() => router.push('/dataroom/profile')}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">Profile</p>
              <p className="text-xs text-slate-400">Settings</p>
            </div>
          )}
        </button>
      </div>
    </nav>
  );
}
