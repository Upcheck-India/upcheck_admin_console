'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import {
  User, Mail, Phone, Briefcase, MapPin, Calendar, Globe, Edit2,
  ChevronLeft, Shield, Clock, CheckCircle, XCircle, Github, Linkedin,
  Plus, ArrowUpRight, Star, GitFork, Loader2, AlertTriangle,
  Building2, Users, Hash, Link2, FileText, StickyNote, Activity,
  ClipboardList, Lock, Info, UserCheck, RefreshCw, Download, X,
  KeyRound, Layers
} from 'lucide-react';
import { FaLinkedin } from 'react-icons/fa';
import GithubReposDialog from '../../../components/GithubReposDialog';

const TABS = [
  { id: 'overview',  label: 'Overview',       icon: User },
  { id: 'timeline',  label: 'Timeline',        icon: Activity },
  { id: 'notes',     label: 'Notes',           icon: StickyNote },
  { id: 'access',    label: 'System Access',   icon: Lock },
];

const STATUS_COLORS = {
  active:    'bg-emerald-100 text-emerald-800 border-emerald-200',
  suspended: 'bg-amber-100 text-amber-800 border-amber-200',
  alumni:    'bg-slate-100 text-slate-700 border-slate-200',
  archived:  'bg-gray-100 text-gray-600 border-gray-200',
  on_leave:  'bg-blue-100 text-blue-800 border-blue-200',
  terminated:'bg-red-100 text-red-800 border-red-200',
};

const TYPE_COLORS = {
  employee:   'bg-blue-100 text-blue-800',
  intern:     'bg-purple-100 text-purple-800',
  contractor: 'bg-orange-100 text-orange-800',
};

const TIMELINE_EVENT_STYLES = {
  joined:      { color: 'bg-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50' },
  exit:        { color: 'bg-red-500',     border: 'border-red-200',     bg: 'bg-red-50' },
  suspended:   { color: 'bg-amber-500',   border: 'border-amber-200',   bg: 'bg-amber-50' },
  reinstated:  { color: 'bg-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50' },
  're-hired':  { color: 'bg-blue-500',    border: 'border-blue-200',    bg: 'bg-blue-50' },
  default:     { color: 'bg-gray-400',    border: 'border-gray-200',    bg: 'bg-gray-50' },
};

function InfoRow({ icon: Icon, label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</div>
        <div className={`text-sm text-gray-800 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(null);

  // Notes
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Timeline event
  const [newEventForm, setNewEventForm] = useState({ event: '', description: '' });
  const [addingEvent, setAddingEvent] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);

  // GitHub
  const [showGithubRepos, setShowGithubRepos] = useState(false);
  const [githubRepos, setGithubRepos] = useState([]);

  const router = useRouter();
  const { id } = useParams();

  // Detect if this is a people_records ID or an admin_users ID
  // People records: accessed via /user_management/people/[id]
  // Admin users: accessed via /user_management/[id]
  const isPeopleRecord = typeof window !== 'undefined' && window.location.pathname.includes('/people/');
  const apiBase = isPeopleRecord ? `/api/people/${id}` : `/api/users/${id}`;

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user || null);
        }
      } catch {}
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!id) { setError('No user ID'); setLoading(false); return; }
    fetchUser();
  }, [id]);

  const fetchUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBase, { credentials: 'include', headers: { 'Cache-Control': 'no-cache' } });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to load profile');
      }
      const data = await res.json();
      setUserData(isPeopleRecord ? data.person : data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = currentUser?.role === 'Console admin' || currentUser?.role === 'Admin';
  const isConsoleAdmin = currentUser?.role === 'Console admin';

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(apiBase, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addNote: { text: newNote.trim() } }),
      });
      if (!res.ok) throw new Error('Failed to add note');
      setNewNote('');
      toast.success('Note added');
      fetchUser();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAddingNote(false);
    }
  };

  const handleAddTimelineEvent = async () => {
    if (!newEventForm.event.trim()) return;
    setAddingEvent(true);
    try {
      const res = await fetch(apiBase, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addTimelineEvent: newEventForm }),
      });
      if (!res.ok) throw new Error('Failed to add event');
      setNewEventForm({ event: '', description: '' });
      setShowAddEvent(false);
      toast.success('Event added to timeline');
      fetchUser();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAddingEvent(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = { ...userData };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const name = [userData?.firstName, userData?.lastName].filter(Boolean).join('_') || userData?.username || id;
      a.download = `${name}_profile.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Profile exported');
    } catch (e) {
      toast.error('Export failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">{error}</p>
          <button onClick={() => router.back()} className="mt-4 text-blue-600 text-sm hover:underline">← Go back</button>
        </div>
      </div>
    );
  }

  if (!userData) return null;

  const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || userData.username || 'Unknown';
  const joinDate = userData.joinDate || userData.startDate;
  const exitDate = userData.exitDate || userData.endDate;
  const tenureDays = joinDate ? differenceInDays(exitDate ? new Date(exitDate) : new Date(), new Date(joinDate)) : null;
  const tenureText = tenureDays !== null ? `${Math.floor(tenureDays / 365)}y ${Math.floor((tenureDays % 365) / 30)}m` : null;

  const statusKey = userData.status || userData.employmentStatus || 'active';
  const statusColor = STATUS_COLORS[statusKey] || STATUS_COLORS.active;

  const timeline = [...(userData.timeline || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const notes = [...(userData.notes || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            {isAdmin && (
              <a
                href={`/user_management/${userData.systemUserId || id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit in System
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Profile hero card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Gradient banner */}
          <div className="h-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="flex items-end justify-between -mt-10 mb-4">
              <div className="w-20 h-20 rounded-2xl border-4 border-white bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                {(userData.firstName?.[0] || userData.username?.[0] || '?').toUpperCase()}
              </div>
              <div className="flex items-center gap-2 mb-1">
                {userData.employeeId && (
                  <code className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-mono border border-gray-200">
                    {userData.employeeId}
                  </code>
                )}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                  {statusKey.charAt(0).toUpperCase() + statusKey.slice(1).replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Identity */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
                <p className="text-gray-500 mt-0.5">
                  {userData.jobTitle || 'No title'} {userData.department ? `· ${userData.department}` : ''}
                </p>
                {userData.email && (
                  <a href={`mailto:${userData.email}`} className="flex items-center gap-1.5 text-blue-600 text-sm mt-1 hover:underline">
                    <Mail className="w-3.5 h-3.5" />
                    {userData.email}
                  </a>
                )}
              </div>
              {/* Quick stats */}
              <div className="flex gap-6">
                {joinDate && (
                  <div className="text-center">
                    <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Joined</div>
                    <div className="text-sm font-semibold text-gray-700 mt-0.5">
                      {format(new Date(joinDate), 'MMM d, yyyy')}
                    </div>
                  </div>
                )}
                {tenureText && (
                  <div className="text-center">
                    <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Tenure</div>
                    <div className="text-sm font-semibold text-gray-700 mt-0.5">{tenureText}</div>
                  </div>
                )}
                {exitDate && (
                  <div className="text-center">
                    <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Exited</div>
                    <div className="text-sm font-semibold text-gray-700 mt-0.5">
                      {format(new Date(exitDate), 'MMM d, yyyy')}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Re-hire badge */}
            {userData.status === 'alumni' && (
              <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${userData.reHireEligible !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {userData.reHireEligible !== false ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {userData.reHireEligible !== false ? 'Eligible for re-hire' : 'Not eligible for re-hire'}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="border-b border-gray-100">
            <nav className="flex px-4 gap-1 overflow-x-auto">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* ── OVERVIEW TAB ── */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Personal Info */}
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact Information</h3>
                  <InfoRow icon={Mail}     label="Work Email"      value={userData.email} />
                  <InfoRow icon={Mail}     label="Personal Email"  value={userData.personalEmail} />
                  <InfoRow icon={Phone}    label="Phone"           value={userData.phone} />
                  <InfoRow icon={MapPin}   label="Location"        value={userData.location} />
                  <InfoRow icon={Globe}    label="Timezone"        value={userData.timezone} />
                </div>

                {/* Employment Info */}
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Employment</h3>
                  <InfoRow icon={Briefcase}  label="Job Title"        value={userData.jobTitle} />
                  <InfoRow icon={Building2}  label="Department"        value={userData.department} />
                  <InfoRow icon={Layers}     label="Type"              value={userData.type ? (TYPE_COLORS[userData.type] ? userData.type.charAt(0).toUpperCase() + userData.type.slice(1) : userData.employmentType) : userData.employmentType} />
                  <InfoRow icon={Users}      label="Manager"           value={userData.managerName || (userData.manager ? [userData.manager.firstName, userData.manager.lastName].filter(Boolean).join(' ') || userData.manager.username : null)} />
                  <InfoRow icon={Calendar}   label="Join Date"         value={joinDate ? format(new Date(joinDate), 'MMMM d, yyyy') : null} />
                  {exitDate && <InfoRow icon={Calendar} label="Exit Date" value={format(new Date(exitDate), 'MMMM d, yyyy')} />}
                  {userData.exitType && <InfoRow icon={Info} label="Exit Type" value={userData.exitType.replace('_', ' ')} />}
                  {userData.exitReason && <InfoRow icon={FileText} label="Exit Reason" value={userData.exitReason} />}
                  {userData.reHireNotes && <InfoRow icon={StickyNote} label="Re-hire Notes" value={userData.reHireNotes} />}
                </div>

                {/* Bio */}
                {userData.bio && (
                  <div className="lg:col-span-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bio</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{userData.bio}</p>
                  </div>
                )}

                {/* Teams */}
                {userData.teams?.length > 0 && (
                  <div className="lg:col-span-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Teams</h3>
                    <div className="flex flex-wrap gap-2">
                      {userData.teams.map(t => (
                        <span key={t._id} className={`px-3 py-1.5 rounded-lg text-sm border ${t.isLead ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                          {t.name} {t.isLead && <span className="text-xs font-medium text-blue-600 ml-1">(Lead)</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TIMELINE TAB ── */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                {isAdmin && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowAddEvent(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Event
                    </button>
                  </div>
                )}

                {showAddEvent && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-blue-800">Add Timeline Event</h4>
                    <input
                      type="text"
                      placeholder="Event title (e.g. promoted, department_change)"
                      value={newEventForm.event}
                      onChange={e => setNewEventForm(p => ({ ...p, event: e.target.value }))}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <textarea
                      placeholder="Description (optional)"
                      value={newEventForm.description}
                      onChange={e => setNewEventForm(p => ({ ...p, description: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowAddEvent(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg">Cancel</button>
                      <button
                        onClick={handleAddTimelineEvent}
                        disabled={addingEvent || !newEventForm.event.trim()}
                        className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700"
                      >
                        {addingEvent ? 'Adding...' : 'Add Event'}
                      </button>
                    </div>
                  </div>
                )}

                {timeline.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No timeline events yet</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                    <div className="space-y-4 pl-12">
                      {timeline.map((event, i) => {
                        const style = TIMELINE_EVENT_STYLES[event.event] || TIMELINE_EVENT_STYLES.default;
                        return (
                          <div key={i} className="relative">
                            <div className={`absolute -left-10 w-4 h-4 rounded-full ${style.color} border-2 border-white shadow-sm`} />
                            <div className={`${style.bg} border ${style.border} rounded-xl p-4`}>
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-semibold text-gray-800 capitalize">{event.event.replace('_', ' ')}</span>
                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                  {event.date ? format(new Date(event.date), 'MMM d, yyyy · HH:mm') : ''}
                                </span>
                              </div>
                              {event.description && (
                                <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                              )}
                              {event.by && (
                                <p className="text-xs text-gray-400 mt-1.5">by {event.by}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── NOTES TAB ── */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                {!isAdmin ? (
                  <div className="text-center py-12">
                    <Lock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Notes are only visible to admins</p>
                  </div>
                ) : (
                  <>
                    {/* Add note */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                        <StickyNote className="w-4 h-4" />
                        Admin Note (private)
                      </h4>
                      <textarea
                        placeholder="Add a private note about this person..."
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={handleAddNote}
                          disabled={addingNote || !newNote.trim()}
                          className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-lg disabled:opacity-50 hover:bg-amber-700"
                        >
                          {addingNote ? 'Saving...' : 'Add Note'}
                        </button>
                      </div>
                    </div>

                    {notes.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No notes yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {notes.map((note, i) => (
                          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                            <p className="text-sm text-gray-700 leading-relaxed">{note.text}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                              <span>{note.createdBy || 'Admin'}</span>
                              <span>·</span>
                              <span>{note.createdAt ? format(new Date(note.createdAt), 'MMM d, yyyy · HH:mm') : ''}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── SYSTEM ACCESS TAB ── */}
            {activeTab === 'access' && (
              <div className="space-y-6">
                {userData.systemUser || userData.sessionToken !== undefined || userData.role ? (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Account Details</h3>
                        <InfoRow icon={Hash}       label="Account ID"     value={userData._id?.toString() || (userData.systemUser?._id?.toString())} mono />
                        <InfoRow icon={User}       label="Username"       value={userData.username || userData.systemUser?.username} />
                        <InfoRow icon={Shield}     label="Role"           value={userData.role || userData.systemUser?.role} />
                        <InfoRow icon={CheckCircle} label="Email Verified" value={userData.emailVerified ? 'Yes' : 'No'} />
                        <InfoRow icon={Clock}      label="Last Login"     value={userData.lastLogin || userData.systemUser?.lastLogin ? format(new Date(userData.lastLogin || userData.systemUser?.lastLogin), 'MMM d, yyyy · HH:mm') : 'Never'} />
                        <InfoRow icon={Activity}   label="Login Count"    value={String(userData.loginCount || userData.systemUser?.loginCount || 0)} />
                        <InfoRow icon={MapPin}     label="Last IP"        value={userData.lastIpAddress || userData.systemUser?.lastIpAddress} />
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Permissions</h3>
                        {(userData.perms || userData.systemUser?.perms || []).length === 0 ? (
                          <p className="text-sm text-gray-400">No special permissions</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {(userData.perms || userData.systemUser?.perms || []).map(perm => (
                              <span key={perm} className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-medium">
                                {perm}
                              </span>
                            ))}
                          </div>
                        )}

                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-5">Connected Accounts</h3>
                        {userData.oauth?.github && (
                          <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl">
                            <Github className="w-5 h-5 text-gray-800" />
                            <div>
                              <div className="text-sm font-medium text-gray-800">GitHub</div>
                              <div className="text-xs text-gray-500">@{userData.oauth.github.login || userData.githubUsername}</div>
                            </div>
                            <button
                              onClick={() => setShowGithubRepos(true)}
                              className="ml-auto text-xs text-blue-600 hover:underline"
                            >
                              View repos
                            </button>
                          </div>
                        )}
                        {userData.oauth?.google && (
                          <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl mt-2">
                            <Globe className="w-5 h-5 text-red-500" />
                            <div>
                              <div className="text-sm font-medium text-gray-800">Google</div>
                              <div className="text-xs text-gray-500">{userData.oauth.google.email}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <Lock className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">This person does not have a system account</p>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          // Redirect to user management dashboard to trigger addition
                          router.push('/user_management');
                          toast('Tip: Click "Add User" and fill in their email to assign a login credentials.', { icon: 'ℹ️' });
                        }}
                        className="mt-4 text-sm text-blue-600 hover:underline"
                      >
                        Create system account →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GitHub repos dialog */}
      {showGithubRepos && (
        <GithubReposDialog
          userId={id}
          onClose={() => setShowGithubRepos(false)}
        />
      )}
    </div>
  );
}
