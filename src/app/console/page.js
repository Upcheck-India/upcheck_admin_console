'use client';

import React, { useState,useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  LayoutDashboard, 
  FileText, 
  Settings, 
  Bell, 
  BookOpen,
  Building2,
  ClipboardList,
  Briefcase,
  BarChart3,
  Mail,
  HelpCircle,
  LogOut,
  ChevronDown,
  User,
  Key,
  Shield,
  Loader2,
  PenSquareIcon,
  Navigation
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import SecureLoading from "../components/SecureLoading";
import { useRouter } from 'next/navigation';
import ConsoleStats from '../components/ConsoleStats';

// Components
const LoadingState = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
        <p className="mt-4 text-gray-600">Loading console...</p>
      </div>
    </div>
  );

const AdminLandingPage = () => {
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isLoading: authLoading, isAuthenticated } = useAuth(true);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('');
  const router = useRouter();

      useEffect(() => {
        if (isAuthenticated) {
          setIsLoading(false);
        }
      }, [isAuthenticated]);

      useEffect(() => {
          const storedUsername = localStorage.getItem('username');
          if (storedUsername) {
            setUsername(storedUsername);
          }
        }, []);

        const modules = [
          {
            title: "User Management",
            description: "Manage users, roles, and permissions",
            icon: <Users className="w-6 h-6 text-white" />,
            link: "/user_management",
            gradient: "from-blue-400 via-teal-500 to-green-400",
            bgLight: "bg-teal-50"
          },
          {
            title: "Content Management",
            description: "Website content and blog management portal",
            icon: <FileText className="w-6 h-6 text-white" />,
            link: "/cms/dashboard",
            gradient: "from-teal-400 via-blue-500 to-teal-400",
            bgLight: "bg-blue-50"
          },
          {
            title: "Project Management",
            description: "Track projects, tasks, and team progress",
            icon: <Briefcase className="w-6 h-6 text-white" />,
            link: "/coming-soon",
            gradient: "from-teal-400 via-green-500 to-blue-600",
            bgLight: "bg-green-50"
          },
          {
            title: "Analytics & Reports",
            description: "Business insights and performance metrics",
            icon: <BarChart3 className="w-6 h-6 text-white" />,
            link: "/coming-soon",
            gradient: "from-teal-400 via-blue-500 to-green-400",
            bgLight: "bg-teal-50"
          },
          {
            title: "Organization",
            description: "Company structure and department management",
            icon: <Building2 className="w-6 h-6 text-white" />,
            link: "/coming-soon",
            gradient: "from-blue-400 via-green-500 to-teal-400",
            bgLight: "bg-blue-50"
          },
          {
            title: "Documentation",
            description: "Internal announcements, documents and procedure guides",
            icon: <BookOpen className="w-6 h-6 text-white" />,
            link: "/coming-soon",
            gradient: "from-green-400 via-teal-500 to-blue-400",
            bgLight: "bg-green-50"
          }
      ];

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

// Update the userDropdownItems array:
const userDropdownItems = [
  { icon: <User className="w-4 h-4" />, label: "Account Settings", link: "/coming-soon" },
  { icon: <Key className="w-4 h-4" />, label: "Security", link: "/coming-soon" },
  { icon: <Shield className="w-4 h-4" />, label: "Privacy", link: "/coming-soon" },
  { icon: <LogOut className="w-4 h-4" />, label: "Logout", onClick: handleLogout }
];

  if (authLoading) {
    return <SecureLoading />;
  }

  // Show loading state while fetching posts
  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top Navigation */}
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="bg-gradient-to-r from-teal-500 to-blue-500 p-2 rounded-lg">
                <LayoutDashboard className="h-6 w-6 text-white" />
              </div>
              <span className="ml-2 text-xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
                Upcheck Console
              </span>
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <div className="space-y-1">
                <div className="w-6 h-0.5 bg-gray-600"></div>
                <div className="w-6 h-0.5 bg-gray-600"></div>
                <div className="w-6 h-0.5 bg-gray-600"></div>
              </div>
            </button>

            <div className="hidden md:flex items-center space-x-4">
              <button className="p-2 rounded-full hover:bg-gray-100 relative">
                <Bell className="h-6 w-6 text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button className="p-2 rounded-full hover:bg-gray-100">
                <Settings className="h-6 w-6 text-gray-600" />
              </button>
              <div className="relative">
                <button 
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100"
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">{username.slice(0, 1).toUpperCase()}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{username}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {/* User Dropdown modified section */}
        {isUserDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-10">
            {userDropdownItems.map((item, index) => (
              item.onClick ? (
                // Render button for logout
                <button
                  key={index}
                  onClick={item.onClick}
                  className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ) : (
                // Render Link for other items
                <Link
                  href={item.link}
                  key={index}
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
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

        {/* Mobile menu modified section */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t p-4">
            <div className="flex flex-col space-y-4">
              <button className="flex items-center space-x-2 text-gray-600">
                <Bell className="h-5 w-5" />
                <span>Notifications</span>
              </button>
              <button className="flex items-center space-x-2 text-gray-600">
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </button>
              {userDropdownItems.map((item, index) => (
                item.onClick ? (
                  // Render button for logout
                  <button
                    key={index}
                    onClick={item.onClick}
                    className="flex items-center space-x-2 text-gray-600"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ) : (
                  // Render Link for other items
                  <Link
                    href={item.link}
                    key={index}
                    className="flex items-center space-x-2 text-gray-600"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                )
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
        <h1 className="text-2l font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            Hey {username},
          </h1>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            Welcome to your Console ✨
          </h1>
          <p className="mt-2 text-gray-600">Access and manage all organizational resources from one place</p>
        </div>

        {/* Quick Stats */}
        <ConsoleStats />

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module, index) => (
            <Link href={module.link} key={index}>
              <div className="group relative bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${module.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                
                <div className="relative p-6 flex items-start space-x-4">
                  {/* Icon Container */}
                  <div className={`flex-shrink-0 rounded-lg bg-gradient-to-br ${module.gradient} p-3 shadow-lg`}>
                    {module.icon}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-white transition-colors duration-300">
                      {module.title}
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 group-hover:text-white/90 transition-colors duration-300">
                      {module.description}
                    </p>
                  </div>
                  
                  {/* Arrow indicator */}
                  <div className="flex-shrink-0 self-center">
                    <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-white/10 flex items-center justify-center transition-colors duration-300">
                      <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-white transform -rotate-90 transition-colors duration-300" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Access Tools */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            Quick Access
          </h3>

<div className="flex flex-wrap gap-4">
  {[
    { icon: <PenSquareIcon className="w-5 h-5" />, label: "New post", link: "/cms/new-post" },
    { icon: <ClipboardList className="w-5 h-5" />, label: "Task Board", link: "/coming-soon" },
    { icon: <HelpCircle className="w-5 h-5" />, label: "Support", link: "/coming-soon" }
  ].map((tool, index) => (
    <Link 
      key={index}
      href={tool.link}
      className="flex items-center space-x-2 px-4 py-2 rounded-md bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-700"
    >
      {tool.icon}
      <span>{tool.label}</span>
    </Link>
  ))}
</div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-500">
              © 2025 Upcheck. All rights reserved.
            </div>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-sm text-gray-500 hover:text-gray-900">Help Center</a>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-900">Documentation</a>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-900">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AdminLandingPage;