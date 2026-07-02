'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Mail, Shield, MessageCircle,
  ChevronDown, LogOut, User, Key, X
} from 'lucide-react';
import { useState, useEffect } from 'react';
import AvatarWithStatus from '../../components/AvatarWithStatus';
import useOnlineUsers from '../../hooks/useOnlineUsers';

export default function TopNav() {
  const router = useRouter();
  const onlineUsers = useOnlineUsers();
  const [username, setUsername] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [showOnlineModal, setShowOnlineModal] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('username');
    if (stored) setUsername(stored);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('#topnav-user-dropdown')) {
        setIsUserDropdownOpen(false);
      }
    };
    if (isUserDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserDropdownOpen]);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        localStorage.removeItem('username');
        sessionStorage.clear();
        router.push('/login');
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const userDropdownItems = [
    { icon: <User className="w-4 h-4" />, label: 'Profile', link: '/console/profile' },
    { icon: <Key className="w-4 h-4" />, label: 'Security', link: '/console/profile' },
    { icon: <LogOut className="w-4 h-4" />, label: 'Logout', onClick: handleLogout },
  ];

  return (
    <>
      <nav className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo / Brand */}
            <div className="flex items-center">
              <Link href="/console" className="flex items-center hover:opacity-80 transition-opacity">
                <Image
                  src="/uploads/Upcheck Banner (480 x 144 px).png"
                  alt="Upcheck Logo"
                  width={480}
                  height={144}
                  className="w-48 sm:w-56 h-auto object-contain"
                  priority
                />
              </Link>
            </div>

            {/* Right side icons */}
            <div className="flex items-center space-x-3">

              {/* Online Users */}
              <button
                onClick={() => setShowOnlineModal(true)}
                className="relative flex items-center -space-x-2 hover:opacity-80 transition-opacity"
                title="Online users"
              >
                {onlineUsers.length === 0 ? (
                  <div className="px-2 text-xs text-gray-500 hover:text-gray-700">No online</div>
                ) : (
                  <>
                    {onlineUsers.slice(0, 2).map((u, i) => (
                      <div key={u._id} style={{ zIndex: 10 - i }}>
                        <AvatarWithStatus username={u.username} online className="h-6 w-6 text-xs ring-2 ring-white" />
                      </div>
                    ))}
                    {onlineUsers.length > 2 && (
                      <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs border-2 border-white">
                        +{onlineUsers.length - 2}
                      </div>
                    )}
                  </>
                )}
              </button>

              {/* Console Admin */}
              <Link
                href="/console-admin"
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full relative"
                title="Console Admin"
              >
                <Shield className="h-5 w-5" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />
              </Link>

              {/* Mail */}
              <Link
                href="/mail"
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full relative"
                title="Mail"
              >
                <Mail className="h-5 w-5" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
              </Link>

              {/* Messages */}
              <Link
                href="/messages"
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full relative"
                title="Chat"
              >
                <MessageCircle className="h-5 w-5" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-green-500 ring-2 ring-white" />
              </Link>

              {/* Profile Dropdown */}
              <div className="relative" id="topnav-user-dropdown">
                <button
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none"
                >
                  <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {username.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden sm:block text-sm">{username}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {isUserDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b">{username}</div>
                    {userDropdownItems.map((item, index) =>
                      item.onClick ? (
                        <button
                          key={index}
                          onClick={item.onClick}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ) : (
                        <Link
                          key={index}
                          href={item.link}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {item.icon}
                          {item.label}
                        </Link>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Online Users Modal */}
      {showOnlineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Online Users ({onlineUsers.length})</h2>
              <button onClick={() => setShowOnlineModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {onlineUsers.length === 0 ? (
              <p className="text-gray-500">No users online.</p>
            ) : (
              <ul className="space-y-2 max-h-60 overflow-y-auto">
                {onlineUsers.map(u => (
                  <li key={u._id} className="flex items-center gap-2">
                    <AvatarWithStatus username={u.username} online className="h-8 w-8 text-sm ring-2 ring-white" />
                    <span>{u.username}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
