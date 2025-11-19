'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import UnauthorizedAccess from '../../components/UnauthorizedAccess';
import AvatarWithStatus from '../../components/AvatarWithStatus';
import useOnlineUsers from '../../hooks/useOnlineUsers';
import { Wallet, ClipboardList, Calendar, Briefcase, BarChart3, LayoutDashboard, Shield, Mail, MessageCircle, ChevronDown, ArrowRight } from 'lucide-react';

export default function OrganizationPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');
  const onlineUsers = useOnlineUsers();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) setUsername(storedUsername);
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        localStorage.removeItem('username');
        sessionStorage.clear();
        window.location.href = '/login';
      }
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="relative">
          <div className="h-12 w-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-0 h-12 w-12 border-3 border-indigo-200 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <UnauthorizedAccess />;
  }

  const cards = [
    {
      title: 'Finance Management',
      desc: 'Umbrella for funds, budgets and finance-related modules',
      href: '/organization/finance',
      icon: <Wallet className="w-6 h-6" />, 
      gradient: 'from-indigo-500 via-blue-500 to-teal-500',
      bgGradient: 'from-indigo-50 to-blue-50',
      iconColor: 'text-indigo-600',
      hoverBorder: 'group-hover:border-indigo-300'
    },
    {
      title: 'Vendors & Contracts',
      desc: 'Vendor registry, contracts, renewals and cost centers',
      href: '/organization/vendors',
      icon: <ClipboardList className="w-6 h-6" />, 
      gradient: 'from-teal-500 via-green-500 to-emerald-500',
      bgGradient: 'from-teal-50 to-green-50',
      iconColor: 'text-teal-600',
      hoverBorder: 'group-hover:border-teal-300'
    },
    {
      title: 'Compliance Calendar',
      desc: 'Statutory filings and renewal reminders',
      href: '/organization/compliance',
      icon: <Calendar className="w-6 h-6" />, 
      gradient: 'from-green-500 via-emerald-500 to-teal-500',
      bgGradient: 'from-green-50 to-emerald-50',
      iconColor: 'text-green-600',
      hoverBorder: 'group-hover:border-green-300'
    },
    {
      title: 'Assets & Inventory',
      desc: 'Assets, assignments, warranty and check-in/out',
      href: '/organization/assets',
      icon: <Briefcase className="w-6 h-6" />, 
      gradient: 'from-blue-500 via-indigo-500 to-purple-500',
      bgGradient: 'from-blue-50 to-indigo-50',
      iconColor: 'text-blue-600',
      hoverBorder: 'group-hover:border-blue-300'
    },
    {
      title: 'Org OKRs',
      desc: 'Objectives and key results across teams',
      href: '/organization/okrs',
      icon: <BarChart3 className="w-6 h-6" />, 
      gradient: 'from-purple-500 via-indigo-500 to-blue-500',
      bgGradient: 'from-purple-50 to-indigo-50',
      iconColor: 'text-purple-600',
      hoverBorder: 'group-hover:border-purple-300'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Top Navigation - mirrored from Console */}
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="bg-gradient-to-r from-teal-500 to-blue-500 p-2 rounded-lg">
                <LayoutDashboard className="h-6 w-6 text-white" />
              </div>
              <span className="ml-2 text-xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
                Organization
              </span>
            </div>

            {/* Right side: online, console-admin, mail, chat, profile */}
            <div className="flex items-center space-x-4">
              {/* Online Users Button */}
              <button className="relative flex -space-x-2">
                {onlineUsers.length === 0 ? (
                  <div className="px-2 text-xs text-gray-500 hover:text-gray-700">No online</div>
                ) : (
                  <>
                    {onlineUsers.slice(0,2).map((u,i)=> (
                      <div key={u._id} style={{ zIndex: 10 - i }}>
                        <AvatarWithStatus username={u.username} online className="h-6 w-6 text-xs ring-2 ring-white" />
                      </div>
                    ))}
                    {onlineUsers.length>2 && (
                      <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs border-2 border-white">+{onlineUsers.length-2}</div>
                    )}
                  </>
                )}
              </button>

              {/* Console Admin */}
              <Link href="/console-admin" className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full relative" title="Console admin">
                <Shield className="h-5 w-5" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white"></span>
              </Link>

              {/* Mail */}
              <Link href="/mail" className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full relative" title="Mail">
                <Mail className="h-5 w-5" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
              </Link>

              {/* Chat */}
              <Link href="/messages" className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full relative" title="Chat">
                <MessageCircle className="h-5 w-5" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-green-500 ring-2 ring-white"></span>
              </Link>

              {/* Profile Dropdown */}
              <div className="relative">
                <button onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)} className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none">
                  <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">{(username || user?.username || user?.email || 'U').slice(0,1).toUpperCase()}</span>
                  </div>
                  <span>{username || user?.username || user?.email}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
                {isUserDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b">{username || user?.username || user?.email}</div>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center">
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Status/Quick Info Section (moved just below nav) */}
        <div className="mb-8 bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-slate-600">All systems operational</span>
            </div>
            <div className="text-sm text-slate-500">
              {user?.role && (
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                  {user.role}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Section */}
        <div className="mb-10">
          <div className="inline-block">
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-transparent mb-2">
              Organization
            </h1>
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full" />
          </div>
          <p className="text-slate-600 mt-4 text-lg">Admin hub for org-wide resources and planning</p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((c, i) => (
            <Link href={c.href} key={i} className="group">
              <div className={`relative bg-white rounded-2xl border-2 border-transparent ${c.hoverBorder} shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden h-full`}>
                {/* Gradient Top Bar */}
                <div className={`h-1.5 bg-gradient-to-r ${c.gradient}`} />
                
                {/* Card Content */}
                <div className="p-6 sm:p-7">
                  {/* Icon with gradient background */}
                  <div className={`inline-flex p-3.5 rounded-xl bg-gradient-to-br ${c.bgGradient} mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    <div className={c.iconColor}>
                      {c.icon}
                    </div>
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-700 transition-colors flex items-center justify-between">
                    {c.title}
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all duration-300 opacity-0 group-hover:opacity-100" />
                  </h3>
                  
                  {/* Description */}
                  <p className="text-slate-600 leading-relaxed">{c.desc}</p>
                </div>

                {/* Bottom gradient accent (visible on hover) */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${c.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`} />
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}