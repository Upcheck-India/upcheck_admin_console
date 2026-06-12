'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck, Plus, Edit2, Trash2, X, Loader2 } from 'lucide-react';
import HRNav from '../_components/HRNav';
import { HOLIDAY_TYPES } from '../../../lib/hr/leave';

const TYPE_COLORS = {
  public: 'bg-blue-100 text-blue-800',
  optional: 'bg-amber-100 text-amber-800',
  company: 'bg-purple-100 text-purple-800',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const emptyForm = { name: '', date: '', type: 'public', recurring: false, description: '' };

export default function HolidaysPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Console admin');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (!data.user) { router.push('/login'); return; }
      setCurrentUser(data.user);
    })();
  }, [router]);

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

  const byMonth = MONTHS.map((m, i) => ({ month: m, items: holidays.filter((h) => new Date(h.date).getUTCMonth() === i) }));
  const ty = new Date().getUTCFullYear();
  const years = Array.from({ length: 5 }, (_, i) => ty - 2 + i);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <HRNav />
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center">
            <CalendarCheck className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900">Holiday Calendar</h1>
          </div>
          <div className="flex items-center gap-3">
            <select value={year} onChange={(e) => setYear(+e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {isAdmin && (
              <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="h-4 w-4" /> Add Holiday
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
        ) : holidays.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            <CalendarCheck className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            No holidays configured for {year}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {byMonth.filter((m) => m.items.length > 0).map((m) => (
              <div key={m.month} className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-gray-700 mb-3">{m.month}</h3>
                <div className="space-y-2">
                  {m.items.map((h) => (
                    <div key={h._id} className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2 last:border-0">
                      <div>
                        <div className="font-medium text-gray-900">{h.name}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(h.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
                        </div>
                        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[h.type] || 'bg-gray-100 text-gray-700'}`}>
                          {h.type}{h.recurring ? ' · recurring' : ''}
                        </span>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(h)} className="p-1.5 text-gray-400 hover:text-blue-600"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => remove(h)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Holiday' : 'Add Holiday'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={save} className="p-4 space-y-4">
              {error && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="e.g. Independence Day" />
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
  );
}
