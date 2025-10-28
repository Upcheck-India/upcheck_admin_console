'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import UnauthorizedAccess from '../../../components/UnauthorizedAccess';
import AvatarWithStatus from '../../../components/AvatarWithStatus';
import useOnlineUsers from '../../../hooks/useOnlineUsers';
import {
  Wallet, 
  Layers, 
  Target, 
  BarChart3, 
  LayoutDashboard, 
  Shield, 
  Mail, 
  MessageCircle, 
  ChevronDown,
  ArrowRight,
  TrendingUp,
  DollarSign,
  PieChart,
  Clock,
  ArrowLeft,
  User,
  Key,
  LogOut,
  Sparkles
} from 'lucide-react';
import useBillingAccount from '../funds/_hooks/useBillingAccount';
import AccountSelector from '../funds/_components/AccountSelector';

export default function FinancePage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');
  const onlineUsers = useOnlineUsers();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [username, setUsername] = useState('');
  const { accounts, activeAccountId, selectAccount, addAccount } = useBillingAccount();

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

  const userDropdownItems = [
    { icon: <User className="w-4 h-4" />, label: "Profile", link: "/console/profile" },
    { icon: <Key className="w-4 h-4" />, label: "Security", link: "/console/profile" },
    { icon: <LogOut className="w-4 h-4" />, label: "Logout", onClick: handleLogout }
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="h-14 w-14 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="absolute inset-0 h-14 w-14 border-3 border-indigo-200 rounded-full animate-pulse" />
          </div>
          <p className="mt-6 text-slate-600 font-medium">Loading finance management...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <UnauthorizedAccess />;
  }

  const cards = [
    {
      title: 'Funds & Runway',
      desc: 'Track grants, donations, spending and balance',
      href: '/organization/funds',
      icon: <Wallet className="w-6 h-6" />, 
      gradient: 'from-indigo-500 via-blue-500 to-purple-500',
      bgGradient: 'from-indigo-50 to-blue-50',
      iconColor: 'text-indigo-600',
      hoverBorder: 'group-hover:border-indigo-300',
      available: true
    },
    {
      title: 'Planning & Budgets',
      desc: 'Track grant applications and plan budget allocations',
      href: '/organization/planning-budgets',
      icon: <Target className="w-6 h-6" />, 
      gradient: 'from-teal-500 via-emerald-500 to-green-500',
      bgGradient: 'from-teal-50 to-emerald-50',
      iconColor: 'text-teal-600',
      hoverBorder: 'group-hover:border-teal-300',
      available: true
    },
    {
      title: 'Cost Centers',
      desc: 'Allocate spend to cost centers for reporting',
      href: '#',
      icon: <Layers className="w-6 h-6" />, 
      gradient: 'from-green-500 via-teal-500 to-cyan-500',
      bgGradient: 'from-green-50 to-teal-50',
      iconColor: 'text-green-600',
      hoverBorder: 'group-hover:border-green-300',
      available: false
    },
    {
      title: 'Financial Reports',
      desc: 'Financial summaries and export capabilities',
      href: '#',
      icon: <BarChart3 className="w-6 h-6" />, 
      gradient: 'from-purple-500 via-indigo-500 to-blue-500',
      bgGradient: 'from-purple-50 to-indigo-50',
      iconColor: 'text-purple-600',
      hoverBorder: 'group-hover:border-purple-300',
      available: false
    },
        {
      title: 'Untransferred Funds',
      desc: 'Received by org but not assigned to any billing account',
      href: '/organization/untransferred',
      icon: <Wallet className="w-6 h-6" />, 
      gradient: 'from-emerald-500 via-teal-500 to-green-500',
      bgGradient: 'from-emerald-50 to-green-50',
      iconColor: 'text-emerald-600',
      hoverBorder: 'group-hover:border-emerald-300',
      available: true
    }
  ];

  const quickStats = [
    {
      label: 'Total Budget',
      value: '₹12.5L',
      change: '+12%',
      icon: <DollarSign className="w-5 h-5" />,
      color: 'from-blue-500 to-indigo-500',
      bgColor: 'from-blue-50 to-indigo-50'
    },
    {
      label: 'Monthly Spend',
      value: '₹2.3L',
      change: '-5%',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'from-teal-500 to-green-500',
      bgColor: 'from-teal-50 to-green-50'
    },
    {
      label: 'Runway',
      value: '18 months',
      change: 'Stable',
      icon: <Clock className="w-5 h-5" />,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'from-purple-50 to-pink-50'
    },
    {
      label: 'Categories',
      value: '8 active',
      change: '2 new',
      icon: <PieChart className="w-5 h-5" />,
      color: 'from-orange-500 to-amber-500',
      bgColor: 'from-orange-50 to-amber-50'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Enhanced Top Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
              {/* Back Button */}
              <Link 
                href="/organization"
                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                title="Back to Organization"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-600 p-2 rounded-xl shadow-lg">
                  <Wallet className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Finance Management
                  </span>
                  <div className="h-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full mt-0.5" />
                </div>
              </div>
            </div>

            {/* Right side icons */}
            <div className="flex items-center space-x-2">
              {/* Global Account Selector */}
              <div className="hidden sm:flex items-center gap-2 mr-2">
                <AccountSelector
                  accounts={accounts}
                  activeAccountId={activeAccountId || ''}
                  onSelect={(id) => selectAccount(id)}
                  onAdd={(name) => addAccount(name)}
                />
                <Link href="/organization/finance/accounts" className="px-2 py-1.5 text-xs rounded-lg border bg-white hover:bg-slate-50 text-slate-700">Manage account</Link>
              </div>
              {/* Online Users */}
              <button className="relative flex -space-x-2 hover:scale-105 transition-transform">
                {onlineUsers.length === 0 ? (
                  <div className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100">
                    No users online
                  </div>
                ) : (
                  <>
                    {onlineUsers.slice(0,3).map((u,i)=> (
                      <div key={u._id} style={{ zIndex: 10 - i }} className="transition-transform hover:scale-110">
                        <AvatarWithStatus username={u.username} online className="h-8 w-8 text-xs ring-2 ring-white shadow-sm" />
                      </div>
                    ))}
                    {onlineUsers.length > 3 && (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-xs font-semibold text-slate-700 border-2 border-white shadow-sm">
                        +{onlineUsers.length-3}
                      </div>
                    )}
                  </>
                )}
              </button>

              {/* Console Admin */}
              <Link 
                href="/console-admin" 
                className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl relative transition-all"
                title="Console admin"
              >
                <Shield className="h-5 w-5" />
                <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white animate-pulse" />
              </Link>

              {/* Mail */}
              <Link 
                href="/mail" 
                className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl relative transition-all"
                title="Mail"
              >
                <Mail className="h-5 w-5" />
                <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
              </Link>

              {/* Chat */}
              <Link 
                href="/messages" 
                className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-xl relative transition-all"
                title="Chat"
              >
                <MessageCircle className="h-5 w-5" />
                <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-green-500 ring-2 ring-white" />
              </Link>
              
              {/* Profile Dropdown */}
              <div className="relative ml-2">
                <button 
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)} 
                  className="flex items-center space-x-2 pl-3 pr-2 py-1.5 text-slate-700 hover:bg-slate-100 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md">
                    <span className="text-white text-sm font-semibold">
                      {(username || user?.username || user?.email || 'U').slice(0,1).toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden sm:block font-medium">{username || user?.username || user?.email}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Enhanced Dropdown */}
                {isUserDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl py-2 z-50 border border-slate-200 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-900">{username || user?.username || user?.email}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Admin Account</p>
                    </div>
                    {userDropdownItems.map((item, index) => (
                      item.onClick ? (
                        <button
                          key={index}
                          onClick={item.onClick}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors"
                        >
                          {item.icon}
                          <span className="ml-3 font-medium">{item.label}</span>
                        </button>
                      ) : (
                        <Link
                          href={item.link}
                          key={index}
                          className="flex items-center space-x-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </Link>
                      )
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Link href="/console" className="hover:text-indigo-600 transition-colors">Console</Link>
            <ChevronDown className="w-4 h-4 -rotate-90" />
            <Link href="/organization" className="hover:text-indigo-600 transition-colors">Organization</Link>
            <ChevronDown className="w-4 h-4 -rotate-90" />
            <span className="text-slate-900 font-medium">Finance</span>
          </div>
        </div>

        {/* Header Section */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-1 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full" />
            <h1 className="text-4xl sm:text-5xl font-bold">
              <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                Finance Management
              </span>
            </h1>
          </div>
          <p className="text-slate-600 text-lg ml-3">Comprehensive financial tracking and reporting</p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {quickStats.map((stat, index) => (
            <div 
              key={index}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-200 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.bgColor}`}>
                  <div className={`bg-gradient-to-br ${stat.color} bg-clip-text text-transparent`}>
                    {stat.icon}
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                  {stat.change}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</h3>
              <p className="text-sm text-slate-600">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Modules Section */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-slate-900"></h3>
            <Sparkles className="w-5 h-5 text-indigo-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {cards.map((c, i) => {
              const Component = c.available ? Link : 'div';
              const linkProps = c.available ? { href: c.href } : {};
              
              return (
                <Component {...linkProps} key={i} className={`group ${!c.available ? 'cursor-not-allowed' : ''}`}>
                  <div className={`relative bg-white rounded-2xl border-2 border-transparent ${c.available ? c.hoverBorder : 'border-slate-200'} shadow-sm ${c.available ? 'hover:shadow-xl' : ''} transition-all duration-300 overflow-hidden h-full ${!c.available ? 'opacity-75' : ''}`}>
                    {/* Gradient Top Bar */}
                    <div className={`h-1.5 bg-gradient-to-r ${c.gradient}`} />
                    
                    {/* Card Content */}
                    <div className="p-6 sm:p-7">
                      {/* Icon with gradient background */}
                      <div className={`inline-flex p-3.5 rounded-xl bg-gradient-to-br ${c.bgGradient} mb-5 ${c.available ? 'group-hover:scale-110' : ''} transition-transform duration-300 relative`}>
                        <div className={c.iconColor}>
                          {c.icon}
                        </div>
                        {!c.available && (
                          <div className="absolute -top-1 -right-2 -left-4 bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                            Unavailable
                          </div>
                        )}
                      </div>
                      
                      {/* Title */}
                      <h3 className={`text-xl font-bold text-slate-900 mb-2 flex items-center justify-between ${c.available ? 'group-hover:text-indigo-700' : ''} transition-colors`}>
                        {c.title}
                        {c.available && (
                          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all duration-300 opacity-0 group-hover:opacity-100" />
                        )}
                      </h3>
                      
                      {/* Description */}
                      <p className="text-slate-600 leading-relaxed">{c.desc}</p>

                      {/* Coming Soon Badge */}
                      {!c.available && (
                        <div className="mt-4 inline-flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="font-medium">Coming Soon</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom gradient accent (visible on hover) */}
                    {c.available && (
                      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${c.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`} />
                    )}
                  </div>
                </Component>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
