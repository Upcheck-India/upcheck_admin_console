'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { MessageCircle, X, ExternalLink, PinOff } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

export default function GlobalChatWrapper() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [lastCheck, setLastCheck] = useState(null);
  const [lastProjectCheck, setLastProjectCheck] = useState(null);
  const [pinnedDm, setPinnedDm] = useState(null);
  const [isFabExpanded, setIsFabExpanded] = useState(false);
  const [fabMessages, setFabMessages] = useState([]);
  const [fabMessageText, setFabMessageText] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch current user and listen to settings updates
  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/check');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          return;
        }
      }
      setCurrentUser(null);
      setPinnedDm(null);
    } catch (err) {
      console.error('Error checking user session:', err);
    }
  };

  useEffect(() => {
    fetchUser();
    window.addEventListener('user-settings-changed', fetchUser);
    return () => window.removeEventListener('user-settings-changed', fetchUser);
  }, [pathname]);

  // ── Notification Polling ──
  useEffect(() => {
    if (!currentUser) return;

    let active = true;
    
    const pollUnread = async () => {
      try {
        const url = `/api/chat/unread${lastCheck ? `?since=${encodeURIComponent(lastCheck)}` : ''}`;
        const res = await fetch(url, { credentials: 'include' });
        if (res.status === 401) {
          setCurrentUser(null);
          setPinnedDm(null);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        
        if (!active) return;
        
        if (data.serverTime) setLastCheck(data.serverTime);
        
        if (data.messages && data.messages.length > 0) {
          // Filter out messages if we are currently on that conversation's page
          const validMessages = data.messages.filter(m => pathname !== `/messages/${m.conversationId}`);
          
          if (validMessages.length > 0) {
            // Pick the latest message to show
            const latest = validMessages[validMessages.length - 1];
            
            // Only show toast popup if notifications are enabled and it's a newly polled message (not initial load)
            if (lastCheck && currentUser.messageNotificationsEnabled !== false) {
              toast.custom((t) => (
                <div
                  className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden`}
                  onClick={() => {
                    toast.dismiss(t.id);
                    router.push(`/messages/${latest.conversationId}`);
                  }}
                >
                  <div className="flex-1 w-0 p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 pt-0.5">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm">
                          {latest.senderName ? latest.senderName.charAt(0).toUpperCase() : 'U'}
                        </div>
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {latest.senderName || 'Unknown User'}
                        </p>
                        <p className="mt-1 text-sm text-gray-500 truncate max-w-[200px]">
                          {latest.body || 'Sent an attachment'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex border-l border-gray-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.dismiss(t.id);
                      }}
                      className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ), { duration: 5000, position: 'top-right' });
            }
          }
          
          // Also check if any message belongs to the pinned DM
          if (pinnedDm) {
            if (!pinnedDm) return null;
            const newFabMessages = data.messages.filter(m => m.conversationId === pinnedDm.conversationId);
            if (newFabMessages.length > 0) {
              setFabMessages(prev => {
                const existingIds = new Set(prev.map(p => p._id));
                const uniqueNew = newFabMessages.filter(m => !existingIds.has(m._id));
                return [...uniqueNew.reverse(), ...prev];
              });
              // Auto expand FAB if collapsed
              if (!isFabExpanded) setIsFabExpanded(true);
            }
          }
        }
      } catch (err) {
        // ignore network errors for background polling
      }
    };

    const pollProjectUnread = async () => {
      try {
        const url = `/api/projects/chat/unread${lastProjectCheck ? `?since=${encodeURIComponent(lastProjectCheck)}` : ''}`;
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        
        if (!active) return;
        
        if (data.serverTime) setLastProjectCheck(data.serverTime);
        
        if (data.messages && data.messages.length > 0) {
          // Filter out messages if we are currently looking at that project's chat (tab or sidebar)
          const activeProjId = typeof window !== 'undefined' ? window.__activeProjectChatId : null;
          const validMessages = data.messages.filter(m => m.projectId !== activeProjId);
          
          if (validMessages.length > 0 && lastProjectCheck && currentUser.messageNotificationsEnabled !== false) {
            validMessages.forEach(msg => {
              toast.custom((t) => (
                <div
                  className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden border-l-4 border-teal-500 cursor-pointer`}
                  onClick={() => {
                    toast.dismiss(t.id);
                    localStorage.setItem('active_tab_' + msg.projectId, 'messages');
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('tab-change-messages', { detail: { projectId: msg.projectId } }));
                    }
                    router.push(`/project_management/${msg.projectId}`);
                  }}
                >
                  <div className="flex-1 w-0 p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 pt-0.5">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                          {msg.senderName ? msg.senderName.charAt(0).toUpperCase() : 'T'}
                        </div>
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
                          Project: {msg.projectName}
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {msg.senderName}
                        </p>
                        <p className="mt-1 text-sm text-gray-500 truncate max-w-[200px]">
                          {msg.body}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex border-l border-gray-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.dismiss(t.id);
                      }}
                      className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-teal-600 hover:text-teal-500 focus:outline-none hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ), { duration: 6000, position: 'top-right' });
            });
          }
        }
      } catch (err) {
        // ignore network errors for background polling
      }
    };

    const interval = setInterval(() => {
      pollUnread();
      pollProjectUnread();
    }, 5000);

    // Initial fetch
    if (!lastCheck) pollUnread();
    if (!lastProjectCheck) pollProjectUnread();

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [lastCheck, lastProjectCheck, pathname, pinnedDm, isFabExpanded, router, currentUser]);

  // ── Pinned DM Listener ──
  useEffect(() => {
    if (!currentUser) {
      setPinnedDm(null);
      return;
    }

    // Check localStorage for pinned DM for this specific user
    const checkPinned = () => {
      const key = `upcheck_pinned_dm_${currentUser.id || currentUser._id}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setPinnedDm(prev => {
            // Only update and fetch if the conversation ID changed or was not set
            if (!prev || prev.conversationId !== parsed.conversationId) {
              fetch(`/api/chat/messages?conversationId=${parsed.conversationId}&limit=20`)
                .then(res => res.json())
                .then(data => {
                  if (data.messages) setFabMessages(data.messages);
                })
                .catch(console.error);
              return parsed;
            }
            return prev;
          });
        } catch (e) {
          console.error(e);
        }
      } else {
        setPinnedDm(null);
      }
    };
    
    checkPinned();
    // Listen for custom event
    window.addEventListener('pinned-dm-changed', checkPinned);
    return () => window.removeEventListener('pinned-dm-changed', checkPinned);
  }, [currentUser]);

  // ── Handle Sending from FAB ──
  const sendFabMessage = async (e) => {
    e.preventDefault();
    if (!fabMessageText.trim() || !pinnedDm) return;
    
    const text = fabMessageText;
    setFabMessageText('');
    
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: pinnedDm.conversationId,
          body: text
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setFabMessages(prev => [data.message, ...prev]);
        }
      }
    } catch (e) {
      console.error('Failed to send fab message:', e);
    }
  };

  // Do not render FAB on the actual messages page of that user
  const isViewingPinnedDm = pinnedDm && pathname === `/messages/${pinnedDm.conversationId}`;

  return (
    <>
      <Toaster />
      
      {/* Floating Action Button / Mini Chat */}
      {pinnedDm && !isViewingPinnedDm && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
          
          {/* Expanded Window */}
          {isFabExpanded && (
            <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col pointer-events-auto mb-4 origin-bottom-right transition-all animate-in slide-in-from-bottom-4 fade-in">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-teal-500 p-3 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                    {pinnedDm.peerName ? pinnedDm.peerName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm leading-tight">{pinnedDm.peerName}</span>
                    <span className="text-[10px] text-white/80">Pinned Chat</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      router.push(`/messages/${pinnedDm.conversationId}`);
                      setIsFabExpanded(false);
                    }}
                    className="p-1.5 hover:bg-white/20 rounded-md transition-colors"
                    title="Open full page"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      if (currentUser) {
                        const key = `upcheck_pinned_dm_${currentUser.id || currentUser._id}`;
                        localStorage.removeItem(key);
                      }
                      setPinnedDm(null);
                      setFabMessages([]);
                      setIsFabExpanded(false);
                      window.dispatchEvent(new Event('pinned-dm-changed'));
                    }}
                    className="p-1.5 hover:bg-white/20 rounded-md transition-colors"
                    title="Unpin Chat"
                  >
                    <PinOff className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setIsFabExpanded(false)}
                    className="p-1.5 hover:bg-white/20 rounded-md transition-colors"
                    title="Minimize"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Messages Area */}
              <div className="h-72 overflow-y-auto p-4 flex flex-col-reverse gap-3 bg-gray-50/50">
                {fabMessages.map((msg, idx) => {
                  const isMine = msg.senderId !== pinnedDm.peerId;
                  return (
                    <div key={msg._id || idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        isMine 
                          ? 'bg-blue-600 text-white rounded-br-sm' 
                          : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
                      }`}>
                        {msg.body}
                      </div>
                    </div>
                  );
                })}
                {fabMessages.length === 0 && (
                  <div className="text-center text-xs text-gray-400 my-auto">
                    No recent messages
                  </div>
                )}
              </div>
              
              {/* Input */}
              <form onSubmit={sendFabMessage} className="p-3 bg-white border-t border-gray-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fabMessageText}
                    onChange={(e) => setFabMessageText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-full px-4 py-2 text-sm transition-all"
                  />
                </div>
              </form>
            </div>
          )}

          {/* FAB Button */}
          <button
            onClick={() => setIsFabExpanded(!isFabExpanded)}
            className={`w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center pointer-events-auto relative ${isFabExpanded ? 'bg-gray-800' : ''}`}
          >
            {isFabExpanded ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
          </button>

        </div>
      )}
    </>
  );
}
