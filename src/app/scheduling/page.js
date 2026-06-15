'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  CalendarClock, Plus, Loader2, Link2, Copy, Check, Trash2, Edit2, X,
  Clock, MapPin, Ban, Globe,
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

        <div className="flex space-x-2 border-b border-gray-200 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                tab === t.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'types' && <EventTypesTab />}
        {tab === 'availability' && <AvailabilityTab />}
        {tab === 'bookings' && <BookingsTab />}
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

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-blue-500" /></div>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New Event Type
        </button>
      </div>

      {types.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CalendarClock className="h-14 w-14 text-blue-200 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No event types yet</h3>
          <p className="text-gray-500 text-sm">Create one to get a shareable booking link.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {types.map((t) => (
            <div key={t._id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color || '#0D84D6' }} />
                  <h3 className="font-semibold text-gray-900 truncate">{t.title}</h3>
                </div>
                {!t.isActive && <span className="text-[10px] uppercase font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Hidden</span>}
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

function BookingsTab() {
  const [scope, setScope] = useState('upcoming');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scheduling/bookings?scope=${scope}`, { credentials: 'include' });
      const data = await res.json();
      setBookings(data.bookings || []);
    } finally {
      setLoading(false);
    }
  }, [scope]);
  useEffect(() => { load(); }, [load]);

  const cancel = async (b) => {
    if (!window.confirm(`Cancel the booking with ${b.inviteeName}?`)) return;
    const res = await fetch(`/api/scheduling/bookings/${b._id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'cancel' }),
    });
    if (res.ok) load();
  };

  return (
    <div>
      <div className="inline-flex bg-gray-100 rounded-lg p-0.5 mb-4">
        {['upcoming', 'past', 'all'].map((s) => (
          <button key={s} onClick={() => setScope(s)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${scope === s ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-blue-500" /></div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">No {scope === 'all' ? '' : scope} bookings.</div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b._id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">{b.eventTypeTitle}</h3>
                  {b.status === 'cancelled' && <span className="text-[10px] uppercase font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">Cancelled</span>}
                </div>
                <p className="text-sm text-gray-600">{b.inviteeName} · {b.inviteeEmail}</p>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDateTime(b.startTime)} ({b.durationMinutes} min)</p>
                {b.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{b.notes}</p>}
              </div>
              {b.status === 'confirmed' && new Date(b.startTime) > new Date() && (
                <button onClick={() => cancel(b)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 shrink-0">
                  <Ban className="h-4 w-4" /> Cancel
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
