'use client';

import Link from 'next/link';
import { useState } from 'react';
import AvatarWithStatus from '../../../../components/AvatarWithStatus';
import {
  Shield,
  Mail,
  MessageCircle,
  ChevronDown,
  ArrowLeft,
} from 'lucide-react';

export default function OrgNavbar({ title, backHref = '/organization/finance', onlineUsers = [], user, username, onLogout }) {
  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href={backHref} className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-600 p-2 rounded-xl" />
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {title}
                </span>
                <div className="h-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full mt-0.5" />
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button className="relative flex -space-x-2">
              {onlineUsers.length === 0 ? (
                <div className="px-3 py-1.5 text-xs text-slate-500">No users online</div>
              ) : (
                <>
                  {onlineUsers.slice(0, 3).map((u, i) => (
                    <div key={u._id} style={{ zIndex: 10 - i }}>
                      <AvatarWithStatus username={u.username} online className="h-8 w-8 text-xs ring-2 ring-white" />
                    </div>
                  ))}
                  {onlineUsers.length > 3 && (
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700 border-2 border-white">
                      +{onlineUsers.length - 3}
                    </div>
                  )}
                </>
              )}
            </button>
            <Link href="/console-admin" className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl relative" title="Console admin">
              <Shield className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />
            </Link>
            <Link href="/mail" className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl relative" title="Mail">
              <Mail className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </Link>
            <Link href="/messages" className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-xl relative" title="Chat">
              <MessageCircle className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500 ring-2 ring-white" />
            </Link>
            <UserMenu user={user} username={username} onLogout={onLogout} />
          </div>
        </div>
      </div>
    </nav>
  );
}

function UserMenu({ user, username, onLogout }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative ml-2">
      <button onClick={() => setOpen(!open)} className="flex items-center space-x-2 pl-3 pr-2 py-1.5 text-slate-700 hover:bg-slate-100 rounded-xl">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
          <span className="text-white text-sm font-semibold">{(username || user?.username || 'U').slice(0, 1).toUpperCase()}</span>
        </div>
        <span className="hidden sm:block font-medium">{username || user?.username}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl py-2 z-50 border">
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-semibold text-slate-900">{username || user?.username}</p>
            <p className="text-xs text-slate-500 mt-0.5">Admin Account</p>
          </div>
          <button onClick={() => window.location.href = '/console'} className="w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50">
            Home page
          </button>
          <button onClick={onLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
