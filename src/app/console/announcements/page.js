'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import SecureLoading from '../../components/SecureLoading';
import FormattedText from '../../../components/FormattedText';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft,
  Plus, 
  Edit, 
  Trash2, 
  Megaphone, 
  AlertTriangle, 
  X, 
  Users, 
  Calendar, 
  ExternalLink,
  ChevronDown,
  Loader2,
  Check
} from 'lucide-react';

export default function AnnouncementsPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth(true);
  const router = useRouter();

  const [announcements, setAnnouncements] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'history'
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [buttonColor, setButtonColor] = useState('#0ea5e9');

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = user?.role === 'Admin' || user?.role === 'Console admin';

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      // Fetch all user-visible announcements (including dismissed)
      const res = await fetch('/api/announcements?all=true');
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements || []);
      }
    } catch (e) {
      console.error('Error fetching announcements:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams?limit=200');
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
      }
    } catch (e) {
      console.error('Error fetching teams:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAnnouncements();
      if (isAdmin) {
        fetchTeams();
      }
    }
  }, [isAuthenticated, user]);

  const handleReact = async (id, emoji) => {
    try {
      const res = await fetch(`/api/announcements/${id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };

  const handleDismiss = async (id) => {
    try {
      const res = await fetch(`/api/announcements/${id}/dismiss`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Error dismissing announcement:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;

    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchAnnouncements();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
    }
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedAnnouncementId(null);
    setTitle('');
    setContent('');
    setIsImportant(false);
    setSelectedTeams([]);
    setButtonText('');
    setButtonUrl('');
    setButtonColor('#0ea5e9');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (a) => {
    setIsEditing(true);
    setSelectedAnnouncementId(a._id);
    setTitle(a.title || '');
    setContent(a.content || '');
    setIsImportant(!!a.isImportant);
    setSelectedTeams(a.teams || []);
    setButtonText(a.buttonText || '');
    setButtonUrl(a.buttonUrl || '');
    setButtonColor(a.buttonColor || '#0ea5e9');
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setFormError('Title and Content are required.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    const payload = {
      title,
      content,
      isImportant,
      teams: selectedTeams,
      buttonText,
      buttonUrl,
      buttonColor,
    };

    try {
      const url = isEditing ? `/api/announcements/${selectedAnnouncementId}` : '/api/announcements';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModal(false);
        fetchAnnouncements();
      } else {
        const err = await res.json();
        setFormError(err.error || 'Something went wrong');
      }
    } catch (error) {
      console.error('Error saving announcement:', error);
      setFormError('Server error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTeamSelection = (teamId) => {
    setSelectedTeams(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId) 
        : [...prev, teamId]
    );
  };

  if (authLoading) {
    return <SecureLoading />;
  }

  // Filter announcements for views
  // 'active' means user has NOT dismissed it.
  // 'history' is all of them (or specifically dismissed ones). Let's show ALL of them in history so they can look back.
  const activeAnnouncements = announcements.filter(a => !(a.dismissedBy || []).includes(user?._id?.toString()));
  const historyAnnouncements = announcements;

  const displayList = activeTab === 'active' ? activeAnnouncements : historyAnnouncements;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      {/* Top Header Section */}
      <nav className="bg-white border-b shadow-sm mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <div className="bg-gradient-to-r from-teal-500 to-blue-500 p-2 rounded-lg mr-3">
                <Megaphone className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
                Upcheck Announcements
              </span>
            </div>
            <Link 
              href="/console" 
              className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-150 rounded-xl border transition-all"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4">
        {/* Back Link & Page Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/console" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-3 group transition-colors">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Dashboard
            </Link>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Announcements</h1>
            <p className="text-gray-500 mt-1">Stay updated with the latest news, events, and updates from the organization.</p>
          </div>
          
          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-650 via-teal-600 to-blue-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all font-semibold text-sm hover:scale-[1.01] active:scale-[0.99]"
            >
              <Plus className="w-4 h-4" />
              New Announcement
            </button>
          )}
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-gray-200 mb-8 gap-6">
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-4 text-sm font-semibold border-b-2 transition-all relative ${
              activeTab === 'active'
                ? 'border-blue-650 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Active
            {activeAnnouncements.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                {activeAnnouncements.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-blue-650 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            All History
          </button>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-3" />
            <p className="text-sm font-medium">Fetching announcements...</p>
          </div>
        ) : displayList.length === 0 ? (
          <div className="bg-white border rounded-2xl p-12 text-center text-gray-500 shadow-sm">
            <Megaphone className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-800 mb-1">No Announcements</h3>
            <p className="text-sm">There are no announcements to display in this tab.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {displayList.map(a => {
              const isDismissed = (a.dismissedBy || []).includes(user?._id?.toString());
              
              // Group reactions
              const groups = {};
              (a.reactions || []).forEach(r => {
                if (!groups[r.emoji]) groups[r.emoji] = [];
                groups[r.emoji].push(r);
              });
              const groupedReactions = Object.entries(groups).map(([emoji, list]) => {
                const hasReacted = list.some(r => r.userId === user?._id?.toString() || r.userId === user?.id?.toString());
                return { emoji, list, hasReacted };
              });

              return (
                <div 
                  key={a._id} 
                  className={`relative overflow-hidden bg-white border rounded-2xl shadow-sm transition-all hover:shadow duration-200 ${
                    isDismissed ? 'opacity-75 hover:opacity-100' : ''
                  }`}
                >
                  {/* Accent Line */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${a.isImportant ? 'from-red-500 to-amber-500' : 'from-teal-500 to-blue-500'}`} />
                  
                  <div className="p-6 pl-8">
                    {/* Card Header */}
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        {a.isImportant ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-150 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Urgent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-150">
                            <Megaphone className="w-3.5 h-3.5" />
                            Announcement
                          </span>
                        )}

                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          Posted by <span className="font-semibold text-gray-700">{a.createdBy?.name || a.createdBy?.username || 'Admin'}</span> on {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => openEditModal(a)}
                              className="p-1.5 rounded-lg border hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(a._id)}
                              className="p-1.5 rounded-lg border hover:bg-gray-50 text-red-550 hover:text-red-700 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {!isDismissed && (
                          <button
                            onClick={() => handleDismiss(a._id)}
                            className="px-2.5 py-1 text-xs font-semibold border rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors"
                            title="Dismiss from dashboard"
                          >
                            Dismiss
                          </button>
                        )}
                        {isDismissed && (
                          <span className="text-xs text-gray-400 font-semibold px-2">Dismissed</span>
                        )}
                      </div>
                    </div>

                    {/* Target Teams for Admins */}
                    {isAdmin && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="text-xs text-gray-400 font-medium self-center mr-1 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Teams:
                        </span>
                        {a.teams && a.teams.length > 0 ? (
                          a.teams.map(teamId => {
                            const teamObj = teams.find(t => t._id === teamId || t._id?.toString() === teamId);
                            return (
                              <span key={teamId} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-semibold">
                                {teamObj ? teamObj.name : 'Unknown Team'}
                              </span>
                            );
                          })
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold">
                            Public
                          </span>
                        )}
                      </div>
                    )}

                    {/* Announcement Title & Content */}
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{a.title}</h2>
                    <div className="text-gray-650 text-[15px] leading-relaxed max-w-3xl">
                      <FormattedText text={a.content} />
                    </div>

                    {/* Action Button */}
                    {a.buttonText && a.buttonUrl && (
                      <div className="mt-4">
                        <a
                          href={a.buttonUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ backgroundColor: a.buttonColor || '#0ea5e9' }}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm hover:shadow transition-all hover:scale-[1.01] active:scale-[0.99]"
                        >
                          {a.buttonText}
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}

                    {/* Card Footer: Reactions */}
                    <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 font-semibold mr-1">React:</span>
                        {['👍', '❤️', '🎉', '🚀', '👀'].map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(a._id, emoji)}
                            className="w-7 h-7 rounded-lg hover:bg-gray-155 flex items-center justify-center text-sm transition-all hover:scale-110 active:scale-95"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {groupedReactions.map(({ emoji, list, hasReacted }) => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(a._id, emoji)}
                            className={`group relative inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs border transition-all ${
                              hasReacted
                                ? 'bg-blue-50/50 border-blue-200 text-blue-700 font-semibold'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className={hasReacted ? 'text-blue-800' : 'text-gray-500'}>{list.length}</span>
                            
                            {/* Reactor Tooltip */}
                            <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none left-1/2 transform -translate-x-1/2">
                              <div className="bg-gray-900/95 text-white text-[10px] rounded-lg py-1.5 px-2.5 whitespace-nowrap shadow-xl leading-tight font-normal">
                                {list.map(u => u.name || u.username).join(', ')}
                              </div>
                              <div className="w-1.5 h-1.5 bg-gray-900/95 rotate-45 -mt-0.75"></div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Creation / Editing Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 relative max-h-[90vh] flex flex-col">
            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {isEditing ? 'Edit Announcement' : 'Create New Announcement'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
                  {formError}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekly All-Hands Meeting"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Content (Markdown formatting supported)
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Supports **bold**, __underline__, [link text](url), etc."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-sans"
                />
              </div>

              {/* Target Teams */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Target Teams (Leave none selected for Public broadcast)
                </label>
                <div className="border rounded-xl p-3 max-h-36 overflow-y-auto bg-gray-50 flex flex-wrap gap-2">
                  {teams.length === 0 ? (
                    <span className="text-xs text-gray-400 font-medium">No teams found</span>
                  ) : (
                    teams.map(team => {
                      const isSelected = selectedTeams.includes(team._id?.toString() || team._id);
                      return (
                        <button
                          key={team._id}
                          type="button"
                          onClick={() => toggleTeamSelection(team._id?.toString() || team._id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          {team.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Urgent Toggle */}
              <div className="flex items-center gap-2.5 py-1.5 border-y border-gray-100">
                <input
                  type="checkbox"
                  id="isImportant"
                  checked={isImportant}
                  onChange={(e) => setIsImportant(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="isImportant" className="text-xs font-bold text-gray-700 cursor-pointer select-none">
                  Set as Important (Urgent alert and Push Notification to everyone)
                </label>
              </div>

              {/* Custom Action Button Section */}
              <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Custom Action Button (Optional)
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Button Text</label>
                    <input
                      type="text"
                      placeholder="e.g. Join Meeting"
                      value={buttonText}
                      onChange={(e) => setButtonText(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Button URL</label>
                    <input
                      type="url"
                      placeholder="https://zoom.us/..."
                      value={buttonUrl}
                      onChange={(e) => setButtonUrl(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Button Color (Hex)</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={buttonColor}
                      onChange={(e) => setButtonColor(e.target.value)}
                      className="w-8 h-8 rounded border p-0.5 cursor-pointer"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      placeholder="#0ea5e9"
                      value={buttonColor}
                      onChange={(e) => setButtonColor(e.target.value)}
                      className="px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs bg-white flex-1 max-w-[120px] font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-gray-50 text-sm font-semibold text-gray-650 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700 transition-colors font-semibold text-sm disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Announcement'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
