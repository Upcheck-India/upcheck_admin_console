'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarCheck, Plus, Edit2, Trash2, X, Loader2,
  ChevronLeft, ChevronRight, Sparkles, CalendarDays,
  List, LayoutGrid,
} from 'lucide-react';
import HRNav from '../_components/HRNav';
import TopNav from '../../components/TopNav';

import { HOLIDAY_TYPES } from '../../../lib/hr/leave';

const TYPE_META = {
  public: { label: 'Public', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', badgeStrong: 'bg-blue-600' },
  optional: { label: 'Optional', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', badgeStrong: 'bg-amber-500' },
  company: { label: 'Company', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', badgeStrong: 'bg-purple-600' },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptyForm = { name: '', date: '', type: 'public', recurring: false, description: '' };

const todayKey = () => {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};

export default function HolidaysPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [gridMonth, setGridMonth] = useState(() => new Date().getUTCMonth());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Managing holidays requires Console admin or the `users.manage` permission.
  const isAdmin = currentUser && (
    currentUser.role === 'Console admin' ||
    (currentUser.perms || []).includes('users.manage')
  );

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (!data.user) { router.push('/login'); return; }
      setCurrentUser(data.user);
    })();
  }, [router]);

  // Remember the user's preferred view (list vs calendar grid).
  useEffect(() => {
    const saved = localStorage.getItem('holidaysViewMode');
    if (saved === 'list' || saved === 'grid') setViewMode(saved);
  }, []);
  useEffect(() => { localStorage.setItem('holidaysViewMode', viewMode); }, [viewMode]);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/holidays?year=${year}`, { credentials: 'include' });
      const data = await res.json();
      setHolidays(data.holidays || []);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { if (currentUser) fetchHolidays(); }, [currentUser, fetchHolidays]);

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setError(''); setModalOpen(true); };
  const openEdit = (h) => {
    setForm({ name: h.name, date: h.date.slice(0, 10), type: h.type, recurring: !!h.recurring, description: h.description || '' });
    setEditingId(h._id);
    setError('');
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.date) { setError('Name and date are required'); return; }
    setSaving(true);
    try {
      const url = editingId ? `/api/hr/holidays/${editingId}` : '/api/hr/holidays';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); return; }
      setModalOpen(false);
      fetchHolidays();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (h) => {
    if (!window.confirm(`Delete holiday "${h.name}"?`)) return;
    const res = await fetch(`/api/hr/holidays/${h._id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) fetchHolidays();
  };

  // Decorate holidays with derived date fields once.
  const decorated = useMemo(() => holidays.map((h) => {
    const d = new Date(h.date);
    const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const weekday = d.getUTCDay();
    return {
      ...h,
      _d: d,
      _key: key,
      _month: d.getUTCMonth(),
      _day: d.getUTCDate(),
      _weekday: weekday,
      _isWeekend: weekday === 0 || weekday === 6,
    };
  }), [holidays]);

  const filtered = useMemo(
    () => decorated.filter((h) => typeFilter === 'all' || h.type === typeFilter),
    [decorated, typeFilter],
  );

  const counts = useMemo(() => ({
    all: decorated.length,
    public: decorated.filter((h) => h.type === 'public').length,
    optional: decorated.filter((h) => h.type === 'optional').length,
    company: decorated.filter((h) => h.type === 'company').length,
  }), [decorated]);

  const tk = todayKey();
  const nextHoliday = useMemo(
    () => decorated.filter((h) => h._key >= tk).sort((a, b) => a._key - b._key)[0] || null,
    [decorated, tk],
  );
  const daysAway = nextHoliday ? Math.round((nextHoliday._key - tk) / 86400000) : null;

  const byMonth = useMemo(() => MONTHS.map((m, i) => ({
    month: m,
    index: i,
    items: filtered.filter((h) => h._month === i).sort((a, b) => a._day - b._day),
  })).filter((m) => m.items.length > 0), [filtered]);

  // Build the 6-week calendar grid (Sun-Sat) for the selected month.
  const monthGrid = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(year, gridMonth, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, gridMonth + 1, 0)).getUTCDate();
    const byDay = {};
    filtered.filter((h) => h._month === gridMonth).forEach((h) => {
      (byDay[h._day] = byDay[h._day] || []).push(h);
    });
    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, key: Date.UTC(year, gridMonth, day), items: byDay[day] || [] });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [filtered, year, gridMonth]);

  const filterChips = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'public', label: 'Public', count: counts.public },
    { id: 'optional', label: 'Optional', count: counts.optional },
    { id: 'company', label: 'Company', count: counts.company },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <HRNav />

        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center">
            <div className="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center mr-3">
              <CalendarCheck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Holiday Calendar</h1>
              <p className="text-sm text-gray-500">National holidays are added automatically. {isAdmin ? 'Edit or add your own below.' : 'Contact an admin to request changes.'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-300 bg-white">
              <button onClick={() => setYear((y) => y - 1)} aria-label="Previous year" className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-l-lg">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1.5 text-sm font-semibold text-gray-900 tabular-nums min-w-[3.5rem] text-center">{year}</span>
              <button onClick={() => setYear((y) => y + 1)} aria-label="Next year" className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-r-lg">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {isAdmin && (
              <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm">
                <Plus className="h-4 w-4" /> Add Holiday
              </button>
            )}
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">Total in {year}</div>
            <div className="text-2xl font-bold text-gray-900">{counts.all}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">Public</div>
            <div className="text-2xl font-bold text-blue-600">{counts.public}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">Optional</div>
            <div className="text-2xl font-bold text-amber-500">{counts.optional}</div>
          </div>
          <div className="rounded-xl shadow-sm p-4 bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
            <div className="text-xs uppercase tracking-wide text-blue-100 flex items-center gap-1"><Sparkles className="h-3 w-3" /> Next holiday</div>
            {nextHoliday ? (
              <div className="mt-0.5">
                <div className="text-sm font-semibold leading-tight truncate">{nextHoliday.name}</div>
                <div className="text-xs text-blue-100">
                  {nextHoliday._d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                  {daysAway === 0 ? ' · Today' : daysAway === 1 ? ' · Tomorrow' : ` · in ${daysAway} days`}
                </div>
              </div>
            ) : (
              <div className="text-sm text-blue-100 mt-1">None upcoming</div>
            )}
          </div>
        </div>

        {/* Type filter + view toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            {filterChips.map((c) => (
              <button
                key={c.id}
                onClick={() => setTypeFilter(c.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  typeFilter === c.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {c.id !== 'all' && <span className={`h-2 w-2 rounded-full ${TYPE_META[c.id].dot}`} />}
                {c.label}
                <span className={`text-xs ${typeFilter === c.id ? 'text-gray-300' : 'text-gray-400'}`}>{c.count}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-lg border border-gray-300 bg-white p-0.5" role="group" aria-label="View mode">
            <button
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <List className="h-4 w-4" /> List
            </button>
            <button
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'grid' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <LayoutGrid className="h-4 w-4" /> Calendar
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
        ) : viewMode === 'grid' ? (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setGridMonth((m) => (m + 11) % 12)} aria-label="Previous month" className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="text-base font-semibold text-gray-900">{MONTHS[gridMonth]} {year}</h3>
              <button onClick={() => setGridMonth((m) => (m + 1) % 12)} aria-label="Next month" className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            {/* Weekday header */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400 py-1">{w}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {monthGrid.flat().map((cell, idx) => {
                if (!cell) return <div key={`e${idx}`} className="min-h-[64px] sm:min-h-[88px] rounded-lg bg-gray-50/50" />;
                const isToday = cell.key === tk;
                const dow = new Date(cell.key).getUTCDay();
                const isWeekend = dow === 0 || dow === 6;
                const main = cell.items[0];
                const meta = main ? (TYPE_META[main.type] || TYPE_META.public) : null;
                return (
                  <div
                    key={cell.key}
                    className={`min-h-[64px] sm:min-h-[88px] rounded-lg border p-1.5 flex flex-col ${
                      main ? `${meta.badge} border-transparent` : isWeekend ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100'
                    }`}
                  >
                    <span className={`text-xs font-semibold ${isToday ? 'h-5 w-5 inline-flex items-center justify-center rounded-full bg-blue-600 text-white' : main ? '' : 'text-gray-500'}`}>{cell.day}</span>
                    <div className="mt-0.5 space-y-0.5 overflow-hidden">
                      {cell.items.slice(0, 2).map((h) => (
                        <button
                          key={h._id}
                          onClick={() => (isAdmin ? openEdit(h) : null)}
                          title={h.name}
                          className={`block w-full text-left text-[10px] leading-tight font-medium truncate ${isAdmin ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
                        >
                          {h.name}
                        </button>
                      ))}
                      {cell.items.length > 2 && (
                        <span className="block text-[10px] text-gray-500">+{cell.items.length - 2} more</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
              {Object.entries(TYPE_META).map(([k, m]) => (
                <span key={k} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />{m.label}</span>
              ))}
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />Today</span>
            </div>
          </div>
        ) : byMonth.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
            <CalendarDays className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            {counts.all === 0 ? `No holidays configured for ${year}.` : 'No holidays match this filter.'}
          </div>
        ) : (
          <div className="space-y-6">
            {byMonth.map((m) => (
              <div key={m.month}>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{m.month} {year}</h3>
                  <span className="text-xs text-gray-400">{m.items.length} {m.items.length === 1 ? 'holiday' : 'holidays'}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
                  {m.items.map((h) => {
                    const meta = TYPE_META[h.type] || TYPE_META.public;
                    const past = h._key < tk;
                    const isNext = nextHoliday && h._id === nextHoliday._id;
                    return (
                      <div key={h._id} className={`group flex items-center gap-4 p-3 sm:p-4 ${past ? 'opacity-55' : ''} ${isNext ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}>
                        {/* Date badge */}
                        <div className={`flex flex-col items-center justify-center h-14 w-14 rounded-lg text-white shrink-0 ${meta.badgeStrong}`}>
                          <span className="text-[10px] font-medium uppercase leading-none opacity-90">{WEEKDAYS[h._weekday]}</span>
                          <span className="text-xl font-bold leading-tight">{h._day}</span>
                          <span className="text-[10px] uppercase leading-none opacity-90">{MONTHS_SHORT[h._month]}</span>
                        </div>
                        {/* Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">{h.name}</span>
                            {isNext && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-600 text-white">UP NEXT</span>}
                            {h._isWeekend && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Weekend</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
                            {h.source === 'default' ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">National</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Custom</span>
                            )}
                            {h.recurring && <span className="text-xs text-gray-400">Recurring</span>}
                            {h.description && <span className="text-xs text-gray-400 truncate">· {h.description}</span>}
                          </div>
                        </div>
                        {/* Actions */}
                        {isAdmin && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => openEdit(h)} aria-label="Edit" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => remove(h)} aria-label="Delete" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Holiday' : 'Add Holiday'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={save} className="p-4 space-y-4">
              {error && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="e.g. Diwali" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  {HOLIDAY_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Public = company-wide off · Optional = restricted/floating · Company = internal</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} className="rounded text-blue-600" />
                Recurring every year
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
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
    </div>
  );
}
