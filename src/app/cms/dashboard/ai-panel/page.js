'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UnauthorizedAccess from '../../../../components/UnauthorizedAccess';
import Image from 'next/image';
import Link from 'next/link';
import {
  Bot, Workflow, Brain, Users, MessageSquare, Settings, ArrowRight,
  LayoutDashboard, LogOut, ChevronDown, User, Sparkles, Code, TerminalSquare, HelpingHand
} from 'lucide-react';

export default function AIPanel() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [username, setUsername] = useState('');
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      setCurrentUser(data.user);
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <Bot className="h-12 w-12 text-blue-500 mx-auto animate-bounce" />
          <p className="mt-4 text-gray-600">Loading AI Panel...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !currentUser.perms?.includes('content.manage')) {
    return <UnauthorizedAccess />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Navigation Bar */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
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

            {/* Profile Dropdown */}
            <div className="flex items-center">
              <div className="relative">
                <button
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none"
                >
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-600 text-sm font-medium">
                      {username.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                  <span>{username}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {isUserDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b">
                      {username}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Jovan Introduction Hero Section */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-12">
          <div className="p-8 lg:p-12 flex flex-col lg:flex-row items-center gap-8">
            <div className="relative w-48 h-48 lg:w-64 lg:h-64 flex-shrink-0">
              <Image
                src="/shrimp_cyborg_logo.png"
                alt="Jovan the AI Shrimp"
                fill
                className="object-contain"
              />
            </div>
            <div className="flex-1 text-center lg:text-left">
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
                Meet Jovan, Your AI Assistant
              </h1>
              <p className="text-lg text-gray-600 mb-6">
                Much like certain groundbreaking AI characters in modern cinema, Jovan represents the future
                of digital assistance. With an empathetic core and adaptive intelligence, Jovan learns and
                evolves alongside you, becoming more attuned to your needs and workflows over time.
              </p>
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                <span className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full flex items-center">
                  <Brain className="w-5 h-5 mr-2" /> Self-Learning AI
                </span>
                <span className="px-4 py-2 bg-purple-50 text-purple-700 rounded-full flex items-center">
                  <Sparkles className="w-5 h-5 mr-2" /> Adaptive Intelligence
                </span>
                <span className="px-4 py-2 bg-teal-50 text-teal-700 rounded-full flex items-center">
                  <Code className="w-5 h-5 mr-2" /> Advanced Integration
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Status Section */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-12">
          <div className="flex items-start gap-4">
            <TerminalSquare className="w-6 h-6 text-amber-600 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-amber-800 mb-2">Current Development Status</h2>
              <p className="text-amber-700">
                Jovan is currently in active development. While the CMS management features are being built,
                you can already access the powerful n8n Workflow Automation portal to create and manage your automated workflows.
              </p>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-green-400 to-emerald-600 text-white rounded-xl shadow-lg p-6 relative overflow-hidden transform transition-transform hover:scale-105">
            <div className="relative z-10">
              <Workflow className="w-8 h-8 mb-4" />
              <h3 className="text-xl font-bold mb-2">Workflow Automation</h3>
              <p className="mb-4 text-green-50">Connect and automate your tools with powerful n8n workflows</p>
              <a
                href="https://n8n.upcheck.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center bg-white text-green-600 px-4 py-2 rounded-lg font-medium hover:bg-green-50"
              >
                Open Workflow Portal <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
            <div className="absolute right-0 bottom-0 opacity-10">
              <Workflow className="w-32 h-32" />
            </div>
          </div>

          {/* Coming Soon Cards */}
          {[
            {
              title: "CMS Management",
              description: "AI-powered content management system",
              icon: Bot,
              color: "from-blue-400 to-blue-600",
              status: "In Development"
            },
            {
              title: "User Management",
              description: "Smart user and role management",
              icon: Users,
              color: "from-purple-400 to-purple-600",
              status: "Coming Soon"
            },
            {
              title: "Customer Support",
              description: "I can respond to customer queries",
              icon: HelpingHand,
              color: "from-pink-400 to-pink-600",
              status: "Coming Soon"
            },
            {
              title: "Organization Assistant",
              description: "Company-wide AI assistance",
              icon: Brain,
              color: "from-indigo-400 to-indigo-600",
              status: "Coming Soon"
            },
            {
              title: "Chat with Jovan",
              description: "Get instant help and answers",
              icon: MessageSquare,
              color: "from-teal-400 to-teal-600",
              status: "Available Now",
              link: "/cms/dashboard/ai-panel/jovan-chat"
            }
          ].map((feature, index) => (
            <div
              key={index}
              className={`bg-gradient-to-br ${feature.color} text-white rounded-xl shadow-lg p-6 relative overflow-hidden ${feature.link ? 'cursor-pointer transform transition-transform hover:scale-105 opacity-100' : 'opacity-75'}`}
              onClick={() => feature.link && router.push(feature.link)}
            >
              <div className="relative z-10">
                <feature.icon className="w-8 h-8 mb-4" />
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="mb-4 text-white/90">{feature.description}</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${feature.link ? 'bg-white text-teal-600 font-medium' : 'bg-white/20'}`}>
                  {feature.status}
                </span>
              </div>
              <div className="absolute right-0 bottom-0 opacity-10">
                <feature.icon className="w-32 h-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}