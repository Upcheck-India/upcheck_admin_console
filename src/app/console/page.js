'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Navigation,
  Bot,
  X,
  Sparkles,
  Brain,
  MessageSquare,
  PartyPopper,
  Video,
  MessageCircle,
  CalendarClock
} from 'lucide-react';
import AvatarWithStatus from '../../components/AvatarWithStatus';
import useHeartbeat from '../../hooks/useHeartbeat';
import useOnlineUsers from '../../hooks/useOnlineUsers';
import Image from 'next/image';
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
  useHeartbeat(true);
  const onlineUsers = useOnlineUsers();
  const pathname = usePathname();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const { isLoading: authLoading, isAuthenticated } = useAuth(true);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [showJovanModal, setShowJovanModal] = useState(false);
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
      title: "Human Resource",
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
      link: "/project_management",
      gradient: "from-teal-400 via-green-500 to-blue-600",
      bgLight: "bg-green-50"
    },
    {
      title: "Meetings",
      description: "Create and manage meetings",
      icon: <Video className="w-6 h-6 text-white" />,
      link: "/events",
      gradient: "from-teal-400 via-blue-500 to-green-400",
      bgLight: "bg-teal-50"
    },
    {
      title: "Scheduling",
      description: "Share booking links and let people pick a time",
      icon: <CalendarClock className="w-6 h-6 text-white" />,
      link: "/scheduling",
      gradient: "from-blue-500 via-cyan-500 to-teal-400",
      bgLight: "bg-cyan-50"
    },
    {
      title: "Organization",
      description: "Company structure, department and financial management",
      icon: <Building2 className="w-6 h-6 text-white" />,
      link: "/organization",
      gradient: "from-blue-400 via-green-500 to-teal-400",
      bgLight: "bg-blue-50"
    },
    {
      title: "Data Management",
      description: "Secure virtual data room for confidential document sharing",
      icon: <BookOpen className="w-6 h-6 text-white" />,
      link: "/dms",
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

  const navItems = [
    { name: 'Dashboard', href: '/console', icon: LayoutDashboard },
    { name: 'Users', href: '/console/users', icon: Users },
    { name: 'Documents', href: '/console/documents', icon: FileText },
    { name: 'Console Admin', href: '/console-admin', icon: Shield },
    { name: 'Settings', href: '/console/settings', icon: Settings },
  ];

  const userDropdownItems = [
    { icon: <User className="w-4 h-4" />, label: "Profile", link: "/console/profile" },
    { icon: <Key className="w-4 h-4" />, label: "Security", link: "/console/profile" },
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
    <>
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
              
              {/* Mail and Profile */}
              <div className="flex items-center space-x-4">
                {/* Online Users Button */}
                <button
                  onClick={() => setShowOnlineModal(true)}
                  className="relative flex -space-x-2">
                  {onlineUsers.length === 0 ? (
                    <div className="px-2 text-xs text-gray-500 hover:text-gray-700">No online</div>
                  ) : (
                    <>
                      {onlineUsers.slice(0,2).map((u,i)=>(
                        <div key={u._id} style={{zIndex:10-i}}>
                          <AvatarWithStatus username={u.username} online className="h-6 w-6 text-xs ring-2 ring-white" />
                        </div>
                        
                      ))}
                      {onlineUsers.length>2 && (
                        <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs border-2 border-white">+{onlineUsers.length-2}</div>
                      )}
                    </>
                  )}
                </button>

                {/* Admin Console Icon */}
                <Link 
                  href="/console-admin" 
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full relative"
                  title="Console admin"
                >
                  <Shield className="h-5 w-5" />
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white"></span>
                </Link>

                {/* Mail Icon */}
                <Link 
                  href="/mail" 
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full relative"
                  title="Mail"
                >
                  <Mail className="h-5 w-5" />
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                </Link>

                <Link 
                  href="/messages" 
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full relative"
                  title="Chat"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-green-500 ring-2 ring-white"></span>
                </Link>
                
                {/* Profile Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none"
                  >
                    <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center">
                      <span className="text-white text-sm font-medium">{username.slice(0, 1).toUpperCase()}</span>
                    </div>
                    <span>{username}</span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>

                  {/* Dropdown Menu */}
                  {isUserDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border">
                      <div className="px-4 py-2 text-sm text-gray-700 border-b">
                        {username}
                      </div>
                      {userDropdownItems.map((item, index) => (
                        item.onClick ? (
                          <button
                            key={index}
                            onClick={item.onClick}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                          >
                            {item.icon}
                            <span className="ml-2">{item.label}</span>
                          </button>
                        ) : (
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
        </nav>

        {/* FAB for Jovan Chat */}
        <Link 
          href="/cms/dashboard/ai-panel/jovan-chat"
          className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 group z-50"
        >
          <div className="relative">
            <Bot className="w-6 h-6 text-white" />
            <div className="absolute -top-12 right-0 bg-white px-3 py-1.5 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
              <span className="text-sm font-medium text-gray-700">Open Jovan Chat</span>
            </div>
          </div>
        </Link>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
              Hey {username},
            </h1>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
              Welcome to your Console ✨
            </h1>
            <div className="mt-2">
              <p className="text-gray-600">Access and manage all organizational resources from one place</p>
              <div className="mt-3">
                <button
                  onClick={() => setShowJovanModal(true)}
                  className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 rounded-full group hover:shadow-lg transition-all duration-300"
                >
                  <Bot className="w-4 h-4 text-white mr-2" />
                  <span className="text-sm font-medium text-white">Powered by Jovan AI</span>
                </button>
              </div>
            </div>
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

      {/* Jovan AI Coming Soon Modal */}
      {showJovanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-8 md:mx-auto p-4 md:p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowJovanModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
            >
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            
            <div className="flex flex-col md:flex-row md:items-center mb-4 md:mb-6">
              <div className="relative w-12 h-12 md:w-16 md:h-16 mb-3 md:mb-0 md:mr-4 mx-auto md:mx-0">
                <Image
                  src="/shrimp_cyborg_logo.png"
                  alt="Jovan AI"
                  fill
                  className="object-contain"
                />
              </div>
              <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 bg-clip-text text-transparent text-center md:text-left">
                Meet Jovan AI
              </h2>
            </div>
            
            <p className="text-gray-600 mb-4 text-sm md:text-base">
              Jovan AI is Upcheck's upcoming artificial intelligence assistant designed to enhance your workflow and productivity of our organization. Jovan will help us manage content, automate tasks throughout the organization, and provide intelligent insights.
            </p>
            
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 md:p-4 mb-4 border border-purple-100">
              <h3 className="font-medium text-purple-800 flex items-center text-sm md:text-base">
                <Settings className="w-4 h-4 mr-2" />
                Development Status
              </h3>
              <p className="text-sm text-purple-700 mt-1">
                Jovan AI is currently in active development. Admins can now access the early preview version to explore upcoming features and provide feedback.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3 md:p-4 mb-4">
              <h3 className="font-medium text-gray-900 mb-2 text-sm md:text-base">Coming Features:</h3>
              <ul className="space-y-2">
                <li className="flex items-center text-xs md:text-sm text-gray-600">
                  <Sparkles className="w-4 h-4 text-purple-500 mr-2 flex-shrink-0" />
                  Smart CMS
                </li>
                <li className="flex items-center text-xs md:text-sm text-gray-600">
                  <Brain className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
                  Intelligent Workflow Automation
                </li>
                <li className="flex items-center text-xs md:text-sm text-gray-600">
                  <MessageSquare className="w-4 h-4 text-teal-500 mr-2 flex-shrink-0" />
                  Chat based operations
                </li>
              </ul>
            </div>
            
            <p className="text-xs md:text-sm text-gray-500 mb-4">
              We're working hard to bring Jovan to life. Stay tuned for updates!
            </p>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowJovanModal(false);
                  router.push('/cms/dashboard/ai-panel');
                }}
                className="inline-flex items-center px-3 py-2 md:px-4 md:py-2 bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 text-sm md:text-base"
              >
                <Bot className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                Try Early Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Online Users Modal */}
      {showOnlineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Online Users ({onlineUsers.length})</h2>
              <button onClick={() => setShowOnlineModal(false)}>
                <X className="h-5 w-5"/>
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
};

export default AdminLandingPage;