'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  CalendarClock, Plus, Loader2, Link2, Copy, Check, Trash2, Edit2, X,
  Clock, MapPin, Ban, Globe, Info, Star, Mail, Calendar, List,
  ChevronLeft, ChevronRight, RefreshCw, AlertTriangle
} from 'lucide-react';
import { WEEKDAYS } from '../../lib/scheduling';

const COMMON_TIMEZONES = [
  'UTC', 'Asia/Kolkata', 'America/New_York', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Asia/Singapore', 'Asia/Dubai', 'Australia/Sydney',
];

const fmtDateTime = (d) =>
  new Date(d).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

export default function SchedulingPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [tab, setTab] = useState('types');
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduling/bookings/stats', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {
      console.error('Failed to load unread bookings count:', e);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadUnreadCount();
    }
  }, [isAuthenticated, loadUnreadCount]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  }
  if (!isAuthenticated) return null;

  const tabs = [
    { id: 'types', label: 'Event Types' },
    { id: 'availability', label: 'Availability' },
    { id: 'bookings', label: 'Bookings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center mb-6">
          <CalendarClock className="h-8 w-8 text-blue-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scheduling</h1>
            <p className="text-sm text-gray-500">Create booking links and let people pick a time that works.</p>
          </div>
        </div>

        <div className="flex space-x-2 border-b border-gray-200 mb-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 ${
                tab === t.id ? 'text-blue-600 border-blue-600' : 'text-gray-500 hover:text-gray-700 border-transparent'
              }`}
            >
              <span>{t.label}</span>
              {t.id === 'bookings' && unreadCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full leading-none">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Informative Hints */}
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 text-sm text-blue-800 shadow-sm">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            {tab === 'types' && (
              <p><strong>Event Types:</strong> These are individual booking templates that others can pick to join you. Copy and share the links to allow self-scheduling.</p>
            )}
            {tab === 'availability' && (
              <p><strong>Availability:</strong> Pick your weekly available days and hours. Note that setting your availability <strong>only affects your own booking links</strong> and does not impact other users' schedules.</p>
            )}
            {tab === 'bookings' && (
              <p><strong>Bookings:</strong> View events others have booked with you. New bookings require attention. Mark them as read, toggle importance, update attendance status, or reply with ready-made email templates.</p>
            )}
          </div>
        </div>

        {tab === 'types' && <EventTypesTab />}
        {tab === 'availability' && <AvailabilityTab />}
        {tab === 'bookings' && <BookingsTab onBookingsUpdated={loadUnreadCount} />}
      </div>
    </div>
  );
}

/* ─────────────────────────  Event Types  ───────────────────────── */

const emptyType = { title: '', durationMinutes: 30, description: '', location: '', isActive: true };

function EventTypesTab() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Search, Sort, Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'hidden'
  const [sortBy, setSortBy] = useState('title-asc'); // 'title-asc' | 'title-desc' | 'duration-asc' | 'duration-desc'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scheduling/event-types', { credentials: 'include' });
      const data = await res.json();
      setTypes(data.eventTypes || []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(emptyType); setError(''); setModalOpen(true); };
  const openEdit = (t) => {
    setEditing(t);
    setForm({ title: t.title, durationMinutes: t.durationMinutes, description: t.description || '', location: t.location || '', isActive: t.isActive });
    setError('');
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/scheduling/event-types/${editing._id}` : '/api/scheduling/event-types';
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, durationMinutes: Number(form.durationMinutes) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); return; }
      setModalOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete "${t.title}"? Existing bookings are kept.`)) return;
    const res = await fetch(`/api/scheduling/event-types/${t._id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) load();
  };

  const bookingUrl = (t) => (typeof window !== 'undefined' ? `${window.location.origin}/book/${t._id}` : `/book/${t._id}`);
  const copyLink = async (t) => {
    try {
      await navigator.clipboard.writeText(bookingUrl(t));
      setCopiedId(t._id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* clipboard may be blocked */ }
  };

  const filteredAndSortedTypes = types
    .filter((t) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        t.title.toLowerCase().includes(query) || 
        (t.description && t.description.toLowerCase().includes(query));

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && t.isActive) ||
        (statusFilter === 'hidden' && !t.isActive);

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'title-asc') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'title-desc') {
        return b.title.localeCompare(a.title);
      } else if (sortBy === 'duration-asc') {
        return a.durationMinutes - b.durationMinutes;
      } else if (sortBy === 'duration-desc') {
        return b.durationMinutes - a.durationMinutes;
      }
      return 0;
    });

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-blue-500" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h3 className="font-bold text-gray-800 text-sm">Manage Event Types ({filteredAndSortedTypes.length})</h3>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-bold shadow-sm">
          <Plus className="h-4 w-4" /> New Event Type
        </button>
      </div>

      {/* Search and Filters Toolbar */}
      {types.length > 0 && (
        <div className="flex flex-col md:flex-row justify-between gap-3 mb-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm shrink-0">
          <div className="flex-1">
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search event types by title or description..."
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer text-gray-600 bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="hidden">Hidden Only</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer text-gray-600 bg-white"
            >
              <option value="title-asc">Title: A-Z</option>
              <option value="title-desc">Title: Z-A</option>
              <option value="duration-asc">Duration: Shortest</option>
              <option value="duration-desc">Duration: Longest</option>
            </select>
          </div>
        </div>
      )}

      {types.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CalendarClock className="h-14 w-14 text-blue-200 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No event types yet</h3>
          <p className="text-gray-500 text-sm">Create one to get a shareable booking link.</p>
        </div>
      ) : filteredAndSortedTypes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 text-sm">
          No event types match your search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredAndSortedTypes.map((t) => (
            <div key={t._id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color || '#0D84D6' }} />
                  <h3 className="font-semibold text-gray-900 truncate">{t.title}</h3>
                </div>
                {!t.isActive && <span className="text-[10px] uppercase font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border">Hidden</span>}
              </div>

              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {t.durationMinutes} min</span>
                {t.location && <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3" /> {t.location}</span>}
              </div>
              {t.description && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{t.description}</p>}

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1">
                <button onClick={() => copyLink(t)} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50">
                  {copiedId === t._id ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Link2 className="h-3.5 w-3.5" /> Copy link</>}
                </button>
                <a href={bookingUrl(t)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-50">
                  <Globe className="h-3.5 w-3.5" /> Preview
                </a>
                <div className="flex-1" />
                <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600"><Edit2 className="h-4 w-4" /></button>
                <button onClick={() => remove(t)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Event Type' : 'New Event Type'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={save} className="p-4 space-y-4">
              {error && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Intro Call" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min) *</label>
                  <input type="number" min="5" max="1440" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Zoom, Office…" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded text-blue-600" />
                Active (link accepts bookings)
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────  Availability  ───────────────────────── */

function AvailabilityTab() {
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/scheduling/availability', { credentials: 'include' });
      const data = await res.json();
      setAvailability(data.availability);
      setLoading(false);
    })();
  }, []);

  const setDay = (day, patch) =>
    setAvailability((a) => ({ ...a, weeklyHours: a.weeklyHours.map((r) => (r.day === day ? { ...r, ...patch } : r)) }));

  const save = async () => {
    setError(''); setSaved(false); setSaving(true);
    try {
      const res = await fetch('/api/scheduling/availability', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(availability),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); return; }
      setAvailability(data.availability);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !availability) return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-blue-500" /></div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 max-w-2xl">
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
        <select
          value={COMMON_TIMEZONES.includes(availability.timezone) ? availability.timezone : '__other'}
          onChange={(e) => e.target.value !== '__other' && setAvailability({ ...availability, timezone: e.target.value })}
          className="w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-lg"
        >
          {COMMON_TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          {!COMMON_TIMEZONES.includes(availability.timezone) && <option value="__other">{availability.timezone}</option>}
        </select>
        <p className="text-xs text-gray-400 mt-1">Slots are offered in this timezone; invitees see them in their own.</p>
      </div>

      <div className="space-y-2">
        {availability.weeklyHours.map((r) => (
          <div key={r.day} className="flex items-center gap-3 py-1.5">
            <label className="flex items-center gap-2 w-28 shrink-0">
              <input type="checkbox" checked={r.enabled} onChange={(e) => setDay(r.day, { enabled: e.target.checked })} className="rounded text-blue-600" />
              <span className={`text-sm font-medium ${r.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{WEEKDAYS[r.day]}</span>
            </label>
            {r.enabled ? (
              <div className="flex items-center gap-2">
                <input type="time" value={r.start} onChange={(e) => setDay(r.day, { start: e.target.value })} className="px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
                <span className="text-gray-400">–</span>
                <input type="time" value={r.end} onChange={(e) => setDay(r.day, { end: e.target.value })} className="px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
              </div>
            ) : (
              <span className="text-sm text-gray-400">Unavailable</span>
            )}
          </div>
        ))}
      </div>

      {error && <div className="mt-4 bg-red-50 text-red-700 text-sm p-2 rounded">{error}</div>}
      <div className="mt-5 flex items-center gap-3">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save availability
        </button>
        {saved && <span className="text-sm text-green-600 flex items-center gap-1"><Check className="h-4 w-4" /> Saved</span>}
      </div>
    </div>
  );
}

/* ─────────────────────────  Bookings  ───────────────────────── */

const TEMPLATES_CONFIG = {
  confirm: {
    name: "Confirmation Details",
    category: "Confirmation",
    desc: "Send meeting link and prep info",
  },
  reschedule: {
    name: "Rescheduling Request",
    category: "Scheduling",
    desc: "Ask guest to choose another time",
  },
  followup: {
    name: "Pre-meeting Follow-up",
    category: "Preparation",
    desc: "Share files or details to read",
  },
  reminder: {
    name: "Upcoming Reminder",
    category: "Preparation",
    desc: "Friendly reminder prior to start",
  },
  thankyou: {
    name: "Post-meeting Wrap-up",
    category: "Follow-up",
    desc: "Thank invitee and outline next steps",
  },
  request_info: {
    name: "Request Information",
    category: "Preparation",
    desc: "Request pre-meeting documents",
  },
  delay: {
    name: "Response Delay Update",
    category: "Update",
    desc: "Apologize for delay and confirm interest",
  }
};

const getTemplatesMap = (booking) => {
  if (!booking) return {};
  const timeStr = new Date(booking.startTime).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
  const ownerName = booking.ownerName || 'Organizer';
  const bookingLink = typeof window !== 'undefined' ? `${window.location.origin}/book/${booking.eventTypeId}` : '';

  return {
    confirm: {
      ...TEMPLATES_CONFIG.confirm,
      subject: `Confirmed: ${booking.eventTypeTitle} with ${ownerName}`,
      body: `Hi ${booking.inviteeName},\n\nI am looking forward to our meeting: "${booking.eventTypeTitle}" on ${timeStr}.\n\nIf you have any questions or details to share beforehand, please let me know.\n\nBest,\n${ownerName}`
    },
    reschedule: {
      ...TEMPLATES_CONFIG.reschedule,
      subject: `Reschedule: Meeting regarding ${booking.eventTypeTitle}`,
      body: `Hi ${booking.inviteeName},\n\nI need to reschedule our meeting: "${booking.eventTypeTitle}" on ${timeStr}.\n\nCould you please pick another time that works for you here: ${bookingLink}?\n\nApologies for the inconvenience.\n\nBest,\n${ownerName}`
    },
    followup: {
      ...TEMPLATES_CONFIG.followup,
      subject: `Follow-up: Meeting regarding ${booking.eventTypeTitle}`,
      body: `Hi ${booking.inviteeName},\n\nThank you for booking "${booking.eventTypeTitle}".\n\nBefore our session on ${timeStr}, please review the following details...\n\nBest,\n${ownerName}`
    },
    reminder: {
      ...TEMPLATES_CONFIG.reminder,
      subject: `Reminder: ${booking.eventTypeTitle} with ${ownerName} is coming up`,
      body: `Hi ${booking.inviteeName},\n\nJust a quick reminder that our meeting: "${booking.eventTypeTitle}" is scheduled for ${timeStr}.\n\nLooking forward to speaking with you soon!\n\nBest,\n${ownerName}`
    },
    thankyou: {
      ...TEMPLATES_CONFIG.thankyou,
      subject: `Thank you: ${booking.eventTypeTitle} wrap-up`,
      body: `Hi ${booking.inviteeName},\n\nIt was great speaking with you today regarding "${booking.eventTypeTitle}".\n\nAs discussed, please let me know if you need anything else. Looking forward to our next steps.\n\nBest,\n${ownerName}`
    },
    request_info: {
      ...TEMPLATES_CONFIG.request_info,
      subject: `Info Needed: ${booking.eventTypeTitle} preparation`,
      body: `Hi ${booking.inviteeName},\n\nThank you for booking "${booking.eventTypeTitle}" on ${timeStr}.\n\nTo help me prepare and make the most of our time, could you please reply with any relevant documents or details beforehand?\n\nBest,\n${ownerName}`
    },
    delay: {
      ...TEMPLATES_CONFIG.delay,
      subject: `Delay Update: ${booking.eventTypeTitle} with ${ownerName}`,
      body: `Hi ${booking.inviteeName},\n\nI wanted to reach out regarding our meeting: "${booking.eventTypeTitle}" on ${timeStr}.\n\nI apologize for any delay in getting back to you. I have received your details and am looking forward to our call.\n\nBest,\n${ownerName}`
    }
  };
};

function BookingsTab({ onBookingsUpdated }) {
  const [scope, setScope] = useState('upcoming');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search, Filter, Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('all'); // 'all' | 'will_attend' | 'will_not_attend' | 'maybe' | 'unconfirmed'
  const [importanceFilter, setImportanceFilter] = useState('all'); // 'all' | 'important'
  const [readFilter, setReadFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [sortBy, setSortBy] = useState('time-desc'); // 'time-desc' | 'time-asc' | 'name-asc' | 'name-desc' | 'duration-asc' | 'duration-desc'

  // Calendar navigation state
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  // Modal states
  const [selectedBookingForReply, setSelectedBookingForReply] = useState(null);
  const [replyTemplate, setReplyTemplate] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [replying, setReplying] = useState(false);

  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState(null);

  // Confirmation modal states
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [bookingToDelete, setBookingToDelete] = useState(null);
  const [bookingToRestore, setBookingToRestore] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scheduling/bookings?scope=${scope}`, { credentials: 'include' });
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const [copiedStatus, setCopiedStatus] = useState(false);

  useEffect(() => {
    if (selectedBookingForReply) {
      setReplyTemplate('confirm');
      const templates = getTemplatesMap(selectedBookingForReply);
      const defaultTmpl = templates['confirm'];
      if (defaultTmpl) {
        setReplySubject(defaultTmpl.subject);
        setReplyMessage(defaultTmpl.body);
      }
    } else {
      setReplyTemplate('');
      setReplySubject('');
      setReplyMessage('');
      setCopiedStatus(false);
    }
  }, [selectedBookingForReply]);

  // Handle actions
  const markAsRead = async (b) => {
    if (!b.isNew) return;
    try {
      const res = await fetch(`/api/scheduling/bookings/${b._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'mark-read' }),
      });
      if (res.ok) {
        setBookings(prev => prev.map(item => item._id === b._id ? { ...item, isNew: false } : item));
        if (selectedBookingForDetail?._id === b._id) {
          setSelectedBookingForDetail(prev => ({ ...prev, isNew: false }));
        }
        if (onBookingsUpdated) onBookingsUpdated();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleImportant = async (b) => {
    try {
      const res = await fetch(`/api/scheduling/bookings/${b._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'toggle-important' }),
      });
      if (res.ok) {
        const updatedBooking = { ...b, isImportant: !b.isImportant };
        setBookings(prev => prev.map(item => item._id === b._id ? updatedBooking : item));
        if (selectedBookingForDetail?._id === b._id) {
          setSelectedBookingForDetail(updatedBooking);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const setAttendance = async (b, status) => {
    try {
      const res = await fetch(`/api/scheduling/bookings/${b._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'set-attendance', status }),
      });
      if (res.ok) {
        const updatedBooking = { ...b, attendanceStatus: status };
        setBookings(prev => prev.map(item => item._id === b._id ? updatedBooking : item));
        if (selectedBookingForDetail?._id === b._id) {
          setSelectedBookingForDetail(updatedBooking);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelBooking = async (e) => {
    e.preventDefault();
    if (!bookingToCancel) return;
    try {
      const res = await fetch(`/api/scheduling/bookings/${bookingToCancel._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'cancel', reason: cancelReason }),
      });
      if (res.ok) {
        setBookingToCancel(null);
        setCancelReason('');
        setSelectedBookingForDetail(null);
        load();
        if (onBookingsUpdated) onBookingsUpdated();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestoreBooking = async () => {
    if (!bookingToRestore) return;
    try {
      const res = await fetch(`/api/scheduling/bookings/${bookingToRestore._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'restore' }),
      });
      if (res.ok) {
        setBookingToRestore(null);
        setSelectedBookingForDetail(null);
        load();
        if (onBookingsUpdated) onBookingsUpdated();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePermanently = async () => {
    if (!bookingToDelete) return;
    try {
      const res = await fetch(`/api/scheduling/bookings/${bookingToDelete._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setBookingToDelete(null);
        setSelectedBookingForDetail(null);
        load();
        if (onBookingsUpdated) onBookingsUpdated();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendReplyEmail = async (e) => {
    e.preventDefault();
    if (!replySubject.trim() || !replyMessage.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/scheduling/bookings/${selectedBookingForReply._id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subject: replySubject, message: replyMessage }),
      });
      if (res.ok) {
        setSelectedBookingForReply(null);
        setReplyTemplate('');
        setReplySubject('');
        setReplyMessage('');
        load();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to send email');
      }
    } catch (err) {
      console.error(err);
      alert('Error sending email');
    } finally {
      setReplying(false);
    }
  };

  const handleTemplateChange = (tmplKey, booking) => {
    setReplyTemplate(tmplKey);
    if (!tmplKey) {
      setReplySubject('');
      setReplyMessage('');
      return;
    }
    const templates = getTemplatesMap(booking);
    const tmpl = templates[tmplKey];
    if (tmpl) {
      setReplySubject(tmpl.subject);
      setReplyMessage(tmpl.body);
    }
  };

  // Calendar calculation
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startDay = new Date(year, month, 1).getDay();
    const numDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDaysNum = new Date(year, month, 0).getDate();

    const cells = [];
    // Fill prev month days
    for (let i = startDay - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, prevMonthDaysNum - i),
        isCurrentMonth: false
      });
    }
    // Fill current month days
    for (let i = 1; i <= numDays; i++) {
      cells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    // Fill next month days to complete 42 cells (6 rows)
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }
    return cells;
  };

  const prevMonth = () => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const isToday = (d) => {
    const today = new Date();
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth() === today.getMonth() &&
           d.getDate() === today.getDate();
  };

  const filteredAndSortedBookings = bookings
    .filter((b) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        b.eventTypeTitle.toLowerCase().includes(query) ||
        b.inviteeName.toLowerCase().includes(query) ||
        b.inviteeEmail.toLowerCase().includes(query) ||
        (b.notes && b.notes.toLowerCase().includes(query));

      const matchesAttendance = attendanceFilter === 'all' || b.attendanceStatus === attendanceFilter;

      const matchesImportance = importanceFilter === 'all' || (importanceFilter === 'important' && b.isImportant);

      const matchesRead = readFilter === 'all' || 
        (readFilter === 'unread' && b.isNew) ||
        (readFilter === 'read' && !b.isNew);

      return matchesSearch && matchesAttendance && matchesImportance && matchesRead;
    })
    .sort((a, b) => {
      if (sortBy === 'time-desc') {
        return new Date(b.startTime) - new Date(a.startTime);
      } else if (sortBy === 'time-asc') {
        return new Date(a.startTime) - new Date(b.startTime);
      } else if (sortBy === 'name-asc') {
        return a.inviteeName.localeCompare(b.inviteeName);
      } else if (sortBy === 'name-desc') {
        return b.inviteeName.localeCompare(a.inviteeName);
      } else if (sortBy === 'duration-asc') {
        return a.durationMinutes - b.durationMinutes;
      } else if (sortBy === 'duration-desc') {
        return b.durationMinutes - a.durationMinutes;
      }
      return 0;
    });

  const calendarCells = getDaysInMonth(currentCalendarDate);

  const getAttendanceBadgeClass = (status) => {
    switch (status) {
      case 'will_attend':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'will_not_attend':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'maybe':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getAttendanceLabel = (status) => {
    switch (status) {
      case 'will_attend': return 'Will Attend';
      case 'will_not_attend': return 'Will Not Attend';
      case 'maybe': return 'Maybe';
      default: return 'Unconfirmed';
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        {/* Scope selector */}
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5 border border-gray-200">
          {['upcoming', 'past', 'trash', 'all'].map((s) => (
            <button key={s} onClick={() => setScope(s)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold capitalize transition-all duration-200 ${
                scope === s 
                  ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* View Mode Toggle */}
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5 border border-gray-200">
          <button 
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-all duration-200 flex items-center gap-1.5 text-xs font-semibold ${
              viewMode === 'list' 
                ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
            }`}
            title="List View"
          >
            <List className="h-4 w-4" />
            <span>List</span>
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={`p-1.5 rounded-md transition-all duration-200 flex items-center gap-1.5 text-xs font-semibold ${
              viewMode === 'calendar' 
                ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
            }`}
            title="Calendar View"
          >
            <Calendar className="h-4 w-4" />
            <span>Calendar</span>
          </button>
        </div>
      </div>

      {/* Bookings Search & Filter Toolbar */}
      {bookings.length > 0 && (
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm mb-4 space-y-2.5">
          <div className="flex flex-col md:flex-row gap-2.5">
            {/* Search Input */}
            <div className="flex-1">
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bookings by guest name, email, event or notes..."
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            {/* Sorting */}
            <div className="shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full md:w-48 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer text-gray-600 bg-white"
              >
                <option value="time-desc">Date: Newest First</option>
                <option value="time-asc">Date: Oldest First</option>
                <option value="name-asc">Guest Name: A-Z</option>
                <option value="name-desc">Guest Name: Z-A</option>
                <option value="duration-asc">Duration: Shortest</option>
                <option value="duration-desc">Duration: Longest</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {/* Attendance Filter */}
            <div>
              <select
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-[10px] font-bold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer text-gray-500 bg-white"
              >
                <option value="all">All RSVP Statuses</option>
                <option value="will_attend">Will Attend</option>
                <option value="will_not_attend">Will Not Attend</option>
                <option value="maybe">Maybe</option>
                <option value="unconfirmed">Unconfirmed</option>
              </select>
            </div>

            {/* Importance Filter */}
            <div>
              <select
                value={importanceFilter}
                onChange={(e) => setImportanceFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-[10px] font-bold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer text-gray-500 bg-white"
              >
                <option value="all">All Importance</option>
                <option value="important">Important Only ⭐</option>
              </select>
            </div>

            {/* Read/Unread Filter */}
            <div>
              <select
                value={readFilter}
                onChange={(e) => setReadFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-[10px] font-bold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer text-gray-500 bg-white"
              >
                <option value="all">All Read Statuses</option>
                <option value="unread">New Only 🔵</option>
                <option value="read">Read Only</option>
              </select>
            </div>

            {/* Reset Filters button if any are active */}
            {(searchQuery || attendanceFilter !== 'all' || importanceFilter !== 'all' || readFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setAttendanceFilter('all');
                  setImportanceFilter('all');
                  setReadFilter('all');
                }}
                className="px-2.5 py-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-blue-500" /></div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          No {scope === 'all' ? '' : scope} bookings found.
        </div>
      ) : filteredAndSortedBookings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          No bookings match your search filters. Try clearing them.
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {filteredAndSortedBookings.map((b) => (
            <div 
              key={b._id} 
              onClick={() => {
                setSelectedBookingForDetail(b);
                markAsRead(b);
              }}
              className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all duration-200 relative overflow-hidden ${
                b.isNew ? 'ring-1 ring-blue-500/30 bg-blue-50/5' : ''
              }`}
            >
              {b.isNew && (
                <div className="absolute top-0 left-0 h-full w-1 bg-blue-600" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900 text-base">{b.eventTypeTitle}</h3>
                  {b.isNew && (
                    <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full animate-pulse">
                      New
                    </span>
                  )}
                  {b.isImportant && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Important
                    </span>
                  )}
                  <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${getAttendanceBadgeClass(b.attendanceStatus)}`}>
                    {getAttendanceLabel(b.attendanceStatus)}
                  </span>
                  {b.status === 'cancelled' && (
                    <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                      Cancelled
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  {b.inviteeName} <span className="text-gray-400 font-normal">({b.inviteeEmail})</span>
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mt-2">
                  <span className="flex items-center gap-1 font-medium text-gray-600">
                    <Clock className="h-3.5 w-3.5 text-blue-500" /> {fmtDateTime(b.startTime)} ({b.durationMinutes} min)
                  </span>
                  {b.repliedAt && (
                    <span className="flex items-center gap-1 font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                      <Mail className="h-3 w-3" /> Replied
                    </span>
                  )}
                </div>
                {b.notes && (
                  <p className="text-xs text-gray-500 bg-gray-50/50 rounded-lg p-2.5 mt-2 border border-gray-100 line-clamp-2 italic">
                    "{b.notes}"
                  </p>
                )}
                {b.cancelReason && (
                  <p className="text-xs text-rose-600 bg-rose-50/20 rounded-lg p-2.5 mt-2 border border-rose-100 line-clamp-2">
                    <strong>Cancellation Reason:</strong> "{b.cancelReason}"
                  </p>
                )}
              </div>
              
              {/* Action Buttons in List Card */}
              <div 
                className="flex items-center gap-2 shrink-0 md:self-center pt-3 md:pt-0 border-t md:border-t-0 border-gray-100"
                onClick={(e) => e.stopPropagation()} // Prevent card trigger
              >
                {b.isNew && (
                  <button 
                    onClick={() => markAsRead(b)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-100"
                    title="Mark as Read"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
                <button 
                  onClick={() => toggleImportant(b)}
                  className={`p-2 rounded-lg transition-all border border-gray-100 ${
                    b.isImportant 
                      ? 'text-amber-500 bg-amber-50 hover:bg-amber-100 hover:text-amber-600 border-amber-200' 
                      : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                  }`}
                  title={b.isImportant ? 'Unmark Important' : 'Mark Important'}
                >
                  <Star className={`h-4 w-4 ${b.isImportant ? 'fill-amber-500' : ''}`} />
                </button>
                {b.status === 'confirmed' && (
                  <>
                    <button 
                      onClick={() => setSelectedBookingForReply(b)}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-100 flex items-center gap-1 text-xs font-semibold px-3"
                      title="Quick Reply Email"
                    >
                      <Mail className="h-4 w-4" />
                      <span>Reply</span>
                    </button>
                    <button 
                      onClick={() => {
                        setBookingToCancel(b);
                        setCancelReason('');
                      }} 
                      className="p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-gray-100 flex items-center gap-1 text-xs font-semibold px-3"
                      title="Cancel Booking"
                    >
                      <Ban className="h-4 w-4" />
                      <span>Cancel</span>
                    </button>
                  </>
                )}
                {b.status === 'cancelled' && (
                  <>
                    <button 
                      onClick={() => setBookingToRestore(b)}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-100 flex items-center gap-1 text-xs font-semibold px-3"
                      title="Restore Booking"
                    >
                      <RefreshCw className="h-4 w-4 animate-spin-slow" />
                      <span>Restore</span>
                    </button>
                    <button 
                      onClick={() => setBookingToDelete(b)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 flex items-center gap-1 text-xs font-semibold px-3"
                      title="Delete Permanently"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Wipe</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Calendar Navigation */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors border border-gray-200">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="font-bold text-gray-800 text-base md:text-lg min-w-[140px] text-center">
                {currentCalendarDate.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors border border-gray-200">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="text-xs text-gray-500 font-semibold bg-gray-50 border px-3 py-1.5 rounded-full flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              <span>{filteredAndSortedBookings.filter(b => {
                const bDate = new Date(b.startTime);
                return bDate.getFullYear() === currentCalendarDate.getFullYear() && bDate.getMonth() === currentCalendarDate.getMonth();
              }).length} bookings this month</span>
            </div>
          </div>

          <div className="p-4 overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Weekdays header */}
              <div className="grid grid-cols-7 gap-2 text-center font-bold text-xs text-gray-400 uppercase tracking-wider mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="py-1">{d}</div>)}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map((cell, idx) => {
                  const dayBookings = filteredAndSortedBookings.filter(b => {
                    const bDate = new Date(b.startTime);
                    return bDate.getFullYear() === cell.date.getFullYear() &&
                           bDate.getMonth() === cell.date.getMonth() &&
                           bDate.getDate() === cell.date.getDate();
                  });

                  return (
                    <div 
                      key={idx} 
                      onClick={() => {
                        // Mark all on this day as read when day is clicked
                        dayBookings.forEach(markAsRead);
                      }}
                      className={`min-h-[100px] border border-gray-100 rounded-lg p-1.5 flex flex-col transition-all duration-200 ${
                        !cell.isCurrentMonth ? 'bg-gray-50/30 opacity-40' : 'bg-white'
                      } ${
                        isToday(cell.date) ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/10' : ''
                      } hover:shadow-sm`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                          isToday(cell.date) ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'
                        }`}>
                          {cell.date.getDate()}
                        </span>
                        {dayBookings.length > 0 && (
                          <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1 py-0.5 rounded">
                            {dayBookings.length}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 space-y-1 overflow-y-auto max-h-[72px] custom-scrollbar">
                        {dayBookings.slice(0, 3).map((b) => (
                          <button
                            key={b._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBookingForDetail(b);
                              markAsRead(b);
                            }}
                            className={`w-full text-left text-[9px] px-1.5 py-0.5 rounded border truncate flex items-center gap-1 ${
                              b.isImportant 
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : b.attendanceStatus === 'will_not_attend'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : b.attendanceStatus === 'maybe'
                                ? 'bg-orange-50 text-orange-800 border-orange-200'
                                : 'bg-blue-50 text-blue-800 border-blue-100'
                            }`}
                          >
                            {b.isImportant && <Star className="h-2 w-2 fill-amber-500 text-amber-500 shrink-0" />}
                            <span className="font-bold shrink-0">{new Date(b.startTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: false })}</span>
                            <span className="truncate">{b.inviteeName}</span>
                          </button>
                        ))}
                        {dayBookings.length > 3 && (
                          <div className="text-[8px] text-gray-500 font-bold text-center bg-gray-100 rounded py-0.5">
                            + {dayBookings.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedBookingForReply && (
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col md:flex-row h-[600px] max-h-[90vh]">
            
            {/* Left Column: Templates Sidebar */}
            <div className="w-full md:w-80 bg-gray-50 border-b md:border-b-0 md:border-r flex flex-col h-1/3 md:h-full">
              <div className="p-4 border-b bg-white/50 shrink-0">
                <h3 className="font-bold text-gray-700 text-sm">Response Templates</h3>
                <p className="text-xs text-gray-400 mt-0.5">Select a template to prefill the email.</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {Object.entries(getTemplatesMap(selectedBookingForReply)).map(([key, tmpl]) => {
                  const isActive = replyTemplate === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleTemplateChange(key, selectedBookingForReply)}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                        isActive
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100/50 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold truncate">{tmpl.name}</span>
                        <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                          isActive 
                            ? 'bg-white/20 text-white' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {tmpl.category}
                        </span>
                      </div>
                      <p className={`line-clamp-2 text-[10px] ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                        {tmpl.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Customizer & Composer */}
            <div className="flex-1 flex flex-col bg-white h-2/3 md:h-full">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-base font-bold">Email Customizer & Sender</h2>
                  <p className="text-xs text-white/80 mt-0.5">To: <span className="font-semibold">{selectedBookingForReply.inviteeName}</span> ({selectedBookingForReply.inviteeEmail})</p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedBookingForReply(null);
                    setReplyTemplate('');
                    setReplySubject('');
                    setReplyMessage('');
                    setCopiedStatus(false);
                  }} 
                  className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Composer */}
              <form onSubmit={handleSendReplyEmail} className="flex-1 flex flex-col p-5 space-y-4 overflow-y-auto">
                <div className="shrink-0">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Subject *</label>
                    <span className="text-[10px] text-gray-400 font-semibold italic">Editable template field</span>
                  </div>
                  <input 
                    type="text"
                    required
                    value={replySubject} 
                    onChange={(e) => setReplySubject(e.target.value)} 
                    placeholder="Subject of the email" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-gray-800" 
                  />
                </div>

                <div className="flex-1 flex flex-col min-h-[150px]">
                  <div className="flex justify-between items-center mb-1 shrink-0">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Message Body *</label>
                    <span className="text-[10px] text-gray-400 font-semibold italic">Customize message below</span>
                  </div>
                  <textarea 
                    required
                    value={replyMessage} 
                    onChange={(e) => setReplyMessage(e.target.value)} 
                    placeholder="Type your message here..." 
                    className="w-full flex-1 p-3 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none font-sans text-gray-700 leading-relaxed resize-none" 
                  />
                </div>

                {/* Toolbar / Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t shrink-0">
                  <div className="flex items-center gap-2">
                    {/* Copy Customized Text Button */}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const textToCopy = `Subject: ${replySubject}\n\n${replyMessage}`;
                          await navigator.clipboard.writeText(textToCopy);
                          setCopiedStatus(true);
                          setTimeout(() => setCopiedStatus(false), 2000);
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                      title="Copy customized subject and message to clipboard"
                    >
                      {copiedStatus ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Message</span>
                        </>
                      )}
                    </button>

                    {/* Reset Template Button */}
                    <button
                      type="button"
                      onClick={() => handleTemplateChange(replyTemplate, selectedBookingForReply)}
                      className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                      title="Reset edited fields back to template defaults"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Reset Default</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={() => {
                        setSelectedBookingForReply(null);
                        setReplyTemplate('');
                        setReplySubject('');
                        setReplyMessage('');
                        setCopiedStatus(false);
                      }} 
                      className="px-4 py-2 border border-gray-200 text-xs font-bold rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Discard
                    </button>
                    <button 
                      type="submit" 
                      disabled={replying} 
                      className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                    >
                      {replying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      <span>Send Email</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBookingForDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Booking Details</span>
                <h2 className="text-lg font-bold mt-1">{selectedBookingForDetail.eventTypeTitle}</h2>
              </div>
              <button 
                onClick={() => setSelectedBookingForDetail(null)} 
                className="text-white/85 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {/* Timing & Duration info */}
              <div className="bg-gray-50 p-4 rounded-xl border flex items-start gap-3">
                <Clock className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{new Date(selectedBookingForDetail.startTime).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', year: 'numeric' })}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Duration: {selectedBookingForDetail.durationMinutes} minutes ({selectedBookingForDetail.timezone})</p>
                  {selectedBookingForDetail.location && (
                    <p className="text-xs text-gray-600 mt-2 font-medium bg-white px-2 py-1 rounded border inline-block">Location: {selectedBookingForDetail.location}</p>
                  )}
                </div>
              </div>

              {/* Invitee Info */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Guest Information</span>
                <div className="p-3 border rounded-xl bg-white space-y-1">
                  <p className="text-sm font-bold text-gray-800">{selectedBookingForDetail.inviteeName}</p>
                  <p className="text-xs text-blue-600 font-semibold">{selectedBookingForDetail.inviteeEmail}</p>
                </div>
              </div>

              {/* Notes */}
              {selectedBookingForDetail.notes && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Notes from Guest</span>
                  <div className="p-3 bg-amber-50/20 border border-amber-100 rounded-xl text-xs text-gray-600 italic">
                    "{selectedBookingForDetail.notes}"
                  </div>
                </div>
              )}

              {/* Cancel Reason */}
              {selectedBookingForDetail.cancelReason && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Cancellation Reason</span>
                  <div className="p-3 bg-red-50/20 border border-red-100 rounded-xl text-xs text-red-700">
                    "{selectedBookingForDetail.cancelReason}"
                  </div>
                </div>
              )}

              {/* Quick Actions Panel */}
              <div className="space-y-2 pt-3 border-t">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Update Booking State</span>
                <div className="flex flex-wrap gap-2 items-center">
                  {/* Important Toggle */}
                  <button 
                    onClick={() => {
                      toggleImportant(selectedBookingForDetail);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      selectedBookingForDetail.isImportant 
                        ? 'text-amber-700 bg-amber-50 border-amber-300 hover:bg-amber-100' 
                        : 'text-gray-600 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <Star className={`h-4 w-4 ${selectedBookingForDetail.isImportant ? 'fill-amber-500 text-amber-500' : ''}`} />
                    <span>{selectedBookingForDetail.isImportant ? 'Starred Important' : 'Mark Important'}</span>
                  </button>

                  {/* Mark Read */}
                  {selectedBookingForDetail.isNew && (
                    <button 
                      onClick={() => {
                        markAsRead(selectedBookingForDetail);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all"
                    >
                      <Check className="h-4 w-4" />
                      <span>Mark Read</span>
                    </button>
                  )}

                  {/* Attendance Selector */}
                  <div className="relative inline-block">
                    <select
                      value={selectedBookingForDetail.attendanceStatus || 'unconfirmed'}
                      onChange={(e) => setAttendance(selectedBookingForDetail, e.target.value)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border hover:bg-gray-50 outline-none text-gray-700 cursor-pointer"
                    >
                      <option value="unconfirmed">Unconfirmed</option>
                      <option value="will_attend">Will Attend</option>
                      <option value="will_not_attend">Will Not Attend</option>
                      <option value="maybe">Maybe</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Major Actions (Cancel, Reply, Restore, Delete Permanent) */}
              <div className="flex flex-wrap gap-2 justify-end pt-4 border-t">
                {selectedBookingForDetail.status === 'confirmed' && (
                  <>
                    <button
                      onClick={() => {
                        setSelectedBookingForReply(selectedBookingForDetail);
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                    >
                      <Mail className="h-4 w-4" />
                      <span>Email Reply</span>
                    </button>
                    <button
                      onClick={() => {
                        setBookingToCancel(selectedBookingForDetail);
                        setCancelReason('');
                      }}
                      className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-1.5"
                    >
                      <Ban className="h-4 w-4" />
                      <span>Cancel Booking</span>
                    </button>
                  </>
                )}

                {selectedBookingForDetail.status === 'cancelled' && (
                  <>
                    <button
                      onClick={() => {
                        setBookingToRestore(selectedBookingForDetail);
                      }}
                      className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Restore Booking</span>
                    </button>
                    <button
                      onClick={() => {
                        setBookingToDelete(selectedBookingForDetail);
                      }}
                      className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Wipe Booking</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Cancel Booking */}
      {bookingToCancel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-rose-50 p-5 border-b border-rose-100 flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-md font-bold text-rose-800">Cancel Booking Invitation?</h2>
                <p className="text-xs text-rose-600 mt-1">This will move the booking to the trash and notify the invitee.</p>
              </div>
            </div>
            
            <form onSubmit={handleCancelBooking} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reason for Cancellation</label>
                <textarea 
                  value={cancelReason} 
                  onChange={(e) => setCancelReason(e.target.value)} 
                  rows={3} 
                  placeholder="Provide a reason (optional)..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5">
                <button 
                  type="button" 
                  onClick={() => setBookingToCancel(null)}
                  className="px-4 py-2 border text-sm font-semibold rounded-lg hover:bg-gray-50 text-gray-600"
                >
                  Discard
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg shadow-sm"
                >
                  Yes, Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Restore Booking */}
      {bookingToRestore && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-emerald-50 p-5 border-b border-emerald-100 flex items-start gap-3">
              <RefreshCw className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5 animate-spin-slow" />
              <div>
                <h2 className="text-md font-bold text-emerald-800">Restore Booking?</h2>
                <p className="text-xs text-emerald-600 mt-1">This will restore the booking status back to confirmed and place it back in your upcoming/past list.</p>
              </div>
            </div>
            
            <div className="p-5 flex justify-end gap-2.5">
              <button 
                type="button" 
                onClick={() => setBookingToRestore(null)}
                className="px-4 py-2 border text-sm font-semibold rounded-lg hover:bg-gray-50 text-gray-600"
              >
                Cancel
              </button>
              <button 
                onClick={handleRestoreBooking}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm"
              >
                Restore Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Permanent Wipe (DELETE) */}
      {bookingToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-red-50 p-5 border-b border-red-100 flex items-start gap-3">
              <Trash2 className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-md font-bold text-red-800">Permanently Delete Booking?</h2>
                <p className="text-xs text-red-600 mt-1">Warning: This action is permanent and cannot be undone. All data regarding this booking will be wiped.</p>
              </div>
            </div>
            
            <div className="p-5 flex justify-end gap-2.5">
              <button 
                type="button" 
                onClick={() => setBookingToDelete(null)}
                className="px-4 py-2 border text-sm font-semibold rounded-lg hover:bg-gray-50 text-gray-600"
              >
                No, Keep it
              </button>
              <button 
                onClick={handleDeletePermanently}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-sm"
              >
                Yes, Wipe it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
