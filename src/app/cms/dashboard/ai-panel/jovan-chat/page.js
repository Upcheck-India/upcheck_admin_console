'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import UnauthorizedAccess from '../../../../../components/UnauthorizedAccess';
import { 
  Bot, 
  LayoutDashboard, 
  Send, 
  Loader2, 
  ChevronDown, 
  LogOut,
  Plus,
  Clock,
  MessageSquare,
  Sparkles,
  Brain,
  User,
  Menu,
  X,
  Trash2
} from 'lucide-react';
import SearchModeSelector from '../../../../components/SearchModeSelector';

export default function JovanChat() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [endpointSessionId, setEndpointSessionId] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchMode, setSearchMode] = useState(null);
  const messagesEndRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
      fetchChatSessions(storedUsername);
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

  const fetchChatSessions = async (username) => {
    try {
      const response = await fetch('/api/jovan-chat/sessions', {
        headers: {
          'x-username': username,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to fetch chat sessions:', errorData);
        throw new Error(errorData.error || 'Failed to fetch chat sessions');
      }

      const sessions = await response.json();
      console.log('Fetched chat sessions:', sessions);
      setChatSessions(sessions);
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      alert('Failed to load chat sessions. Please try refreshing the page.');
    }
  };

  const loadChatHistory = async (sessionId) => {
    try {
      const response = await fetch(`/api/jovan-chat/history?sessionId=${sessionId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to load chat history:', errorData);
        throw new Error(errorData.error || 'Failed to load chat history');
      }

      const history = await response.json();
      console.log('Loaded chat history:', history);
      
      const session = chatSessions.find(s => s._id === sessionId);
      if (session) {
        setEndpointSessionId(session.endpointSessionId);
      }
      
      setMessages(history.map(msg => ({
        role: msg.role,
        content: msg.message
      })));
      setSessionId(sessionId);
    } catch (error) {
      console.error('Error loading chat history:', error);
      alert('Failed to load chat history. Please try again.');
    }
  };

  const startNewChat = async () => {
    try {
      setIsStarting(true);
      const response = await fetch('/api/jovan-chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create chat session:', errorData);
        throw new Error(errorData.error || 'Failed to create chat session');
      }

      const data = await response.json();
      console.log('Chat session created:', data);
      setSessionId(data.sessionId);
      setEndpointSessionId(data.endpointSessionId);
      setMessages([]);
      await fetchChatSessions(username);
    } catch (error) {
      console.error('Error starting new chat:', error);
      alert('Failed to start new chat. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const determineChatTitle = (message) => {
    const content = message.toLowerCase();
    if (content.includes('hello') || content.includes('hi') || content.includes('hey')) {
      return 'Greetings';
    } else if (content.includes('help') || content.includes('can you') || content.includes('how to')) {
      return 'Help Request';
    } else if (content.includes('what') || content.includes('why') || content.includes('when')) {
      return 'Question';
    } else if (content.includes('create') || content.includes('make') || content.includes('build')) {
      return 'Creation Request';
    } else {
      return content.slice(0, 30) + '...';
    }
  };

  const updateChatTitle = async (sessionId, message) => {
    try {
      const newTitle = determineChatTitle(message);
      const response = await fetch('/api/jovan-chat/sessions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ sessionId, title: newTitle })
      });

      if (!response.ok) {
        throw new Error('Failed to update chat title');
      }

      setChatSessions(prev => 
        prev.map(session => 
          session._id === sessionId 
            ? { ...session, title: newTitle }
            : session
        )
      );
    } catch (error) {
      console.error('Error updating chat title:', error);
    }
  };

  const handleSearchModeChange = (mode) => {
    setSearchMode(mode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || !endpointSessionId) return;

    // Store original input for display
    const originalInput = input;
    
    // Prepare request message with search mode context
    let messageContent = input;
    if (searchMode === 'internet') {
      messageContent = "You need to search the internet for this request: " + input;
    } else if (searchMode === 'database') {
      messageContent = "You need to use the mongodb database tool to fetch information regarding this request: " + input;
    }
    
    // Use original input for display, but send modified message to backend
    const userMessage = { role: 'user', content: originalInput };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    let retryCount = 0;
    const MAX_RETRIES = 2; // Client-side retries in addition to server-side retries

    const attemptRequest = async () => {
      try {
        if (messages.length === 0) {
          await updateChatTitle(sessionId, originalInput);
        }

        const response = await fetch('/api/jovan-chat/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: endpointSessionId,
            message: messageContent,
            role: 'user'
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (errorData.retryable && retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            
            // Show retry message to user
            const retryMessage = {
              role: 'assistant',
              content: `The request is taking longer than expected. Retrying in ${delay/1000} seconds... (Attempt ${retryCount} of ${MAX_RETRIES})`
            };
            setMessages(prev => [...prev, retryMessage]);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return attemptRequest();
          }
          throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received response:', data);
        
        let aiContent;
        if (Array.isArray(data) && data.length > 0) {
          aiContent = data[0].output;
        } else if (data.ai_response) {
          aiContent = data.ai_response;
        } else if (typeof data === 'object') {
          aiContent = data.message || data.response;
        }

        if (!aiContent) {
          console.error('Invalid response format:', data);
          throw new Error('Invalid response format');
        }

        // Remove any retry messages
        setMessages(prev => prev.filter(msg => !msg.content.includes('Retrying in')));

        const aiMessage = {
          role: 'assistant',
          content: aiContent
        };

        setMessages(prev => [...prev, aiMessage]);
      } catch (error) {
        console.error('Chat error:', error);
        const errorMessage = {
          role: 'assistant',
          content: error.message.includes('timed out')
            ? "I'm sorry, the request timed out. You can try sending your message again."
            : "I apologize, but I encountered an error processing your message. Please try again in a moment."
        };
        // Remove any retry messages before showing the final error
        setMessages(prev => [
          ...prev.filter(msg => !msg.content.includes('Retrying in')),
          errorMessage
        ]);
      }
    };

    try {
      await attemptRequest();
    } finally {
      setIsTyping(false);
    }
  };

  const initiateDelete = (sessionId) => {
    setChatToDelete(sessionId);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!chatToDelete) return;
    
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/jovan-chat/sessions?sessionId=${chatToDelete}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        if (chatToDelete === sessionId) {
          setSessionId(null);
          setMessages([]);
        }
        await fetchChatSessions(username);
      } else {
        throw new Error('Failed to delete chat session');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setChatToDelete(null);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <Bot className="h-12 w-12 text-blue-500 mx-auto animate-bounce" />
          <p className="mt-4 text-gray-600">Loading Jovan Chat...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !currentUser.perms?.includes('content.manage')) {
    return <UnauthorizedAccess />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <nav className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16">
            <div className="flex items-center">
              <div className="bg-gradient-to-r from-teal-500 to-blue-500 p-1.5 sm:p-2 rounded-lg">
                <LayoutDashboard className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <Link href="/console" className="flex items-center ml-2">
                <span className="text-base sm:text-xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent truncate">
                  Upcheck Console
                </span>
              </Link>
            </div>

            <div className="flex items-center">
              <div className="relative">
                <button
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center space-x-1 sm:space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none"
                >
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {username.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden sm:inline">{username}</span>
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

      <div className="flex h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)]">
        <div className={`w-full sm:w-80 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed sm:relative z-40 h-full`}>
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Chat History</h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="sm:hidden text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4">
            <button
              onClick={startNewChat}
              disabled={isStarting}
              className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  <span>New Chat</span>
                </>
              )}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {chatSessions.map((session) => (
              <div
                key={session._id}
                className="group relative"
              >
                <button
                  onClick={() => loadChatHistory(session._id)}
                  className={`w-full p-3 rounded-lg text-left hover:bg-gray-50 transition-colors ${
                    sessionId === session._id ? 'bg-blue-50 border border-blue-100' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <MessageSquare className="w-5 h-5 text-gray-500" />
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {session.title || 'New Chat'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(session.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    initiateDelete(session._id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-full transition-all duration-200"
                  title="Delete chat"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col relative">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="sm:hidden fixed top-20 left-4 z-50 w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
          >
            <Menu className="w-5 h-5" />
          </button>

          {!sessionId ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-20"></div>
                  <Bot className="w-24 h-24 text-blue-500 relative z-10 animate-float" />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">Welcome to Jovan AI Chat</h3>
                  <p className="text-gray-600 leading-relaxed mb-8">
                    Start a new chat to begin your conversation with Jovan AI.
                  </p>
                  <button
                    onClick={startNewChat}
                    disabled={isStarting}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-all flex items-center space-x-2 mx-auto disabled:opacity-50"
                  >
                    {isStarting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Starting Chat...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        <span>Start New Chat</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex flex-wrap justify-center gap-3 mt-6">
                  <span className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full flex items-center text-sm">
                    <Brain className="w-4 h-4 mr-2" /> AI Assistant
                  </span>
                  <span className="px-4 py-2 bg-purple-50 text-purple-700 rounded-full flex items-center text-sm">
                    <Sparkles className="w-4 h-4 mr-2" /> Smart Responses
                  </span>
                  <span className="px-4 py-2 bg-teal-50 text-teal-700 rounded-full flex items-center text-sm">
                    <MessageSquare className="w-4 h-4 mr-2" /> Natural Conversation
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 bg-gradient-to-b from-gray-50/50 to-white">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-slideIn`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex-shrink-0 mr-2 sm:mr-3 flex items-center justify-center">
                        <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] rounded-xl sm:rounded-2xl p-3 sm:p-4 ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-blue-500/20'
                          : 'bg-white border border-gray-200 text-gray-800 shadow-gray-200/20'
                      } shadow-lg transform hover:scale-[1.01] sm:hover:scale-[1.02] transition-transform`}
                    >
                      <p className="text-sm sm:text-base leading-relaxed break-words">{message.content}</p>
                      <span className="text-[10px] sm:text-xs opacity-70 mt-1 sm:mt-2 block">
                        {new Date().toLocaleTimeString()}
                      </span>
                    </div>
                    {message.role === 'user' && (
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 flex-shrink-0 ml-2 sm:ml-3 flex items-center justify-center">
                        <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                    )}
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start animate-slideIn">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex-shrink-0 mr-2 sm:mr-3 flex items-center justify-center">
                      <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-lg flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>

              <div className="p-3 sm:p-6 border-t bg-white/80 backdrop-blur-sm">
                <SearchModeSelector 
                  searchMode={searchMode}
                  onSearchModeChange={handleSearchModeChange}
                />
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm placeholder:text-gray-400 text-gray-700 text-sm sm:text-base"
                    disabled={isTyping}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isTyping}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base"
                  >
                    {isTyping ? (
                      <>
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                        <span className="hidden sm:inline">Processing...</span>
                        <span className="sm:hidden">...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="hidden sm:inline">Send</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Chat</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this chat? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setChatToDelete(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}