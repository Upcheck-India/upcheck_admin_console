'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import UnauthorizedAccess from '../../../components/UnauthorizedAccess';
import { formatBusinessDate } from '../../../lib/finance/dates';
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  FileCheck,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Trash2,
  X,
} from 'lucide-react';

const TYPE_OPTIONS = ['GST', 'TDS', 'IT', 'ROC', 'FCRA', 'PF', 'ESI', 'other'];

// STATIC class maps — never build tailwind classes from template strings.
const TYPE_BADGE = {
  GST: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  TDS: 'bg-sky-100 text-sky-800 border-sky-200',
  IT: 'bg-violet-100 text-violet-800 border-violet-200',
  ROC: 'bg-orange-100 text-orange-800 border-orange-200',
  FCRA: 'bg-rose-100 text-rose-800 border-rose-200',
  PF: 'bg-teal-100 text-teal-800 border-teal-200',
  ESI: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
};

const STATUS_BADGE = {
  overdue: 'bg-red-100 text-red-700 border-red-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  filed: 'bg-green-100 text-green-700 border-green-200',
};

const RECURRENCE_LABEL = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

const TABS = [
  { key: 'overdue', label: 'Overdue', status: 'overdue' },
  { key: 'upcoming', label: 'Upcoming', status: 'pending' },
  { key: 'filed', label: 'Filed', status: 'filed' },
  { key: 'all', label: 'All', status: '' },
];

const INITIAL_FORM = {
  title: '',
  type: 'GST',
  description: '',
  dueDate: '',
  recurrence: 'none',
  assignedTo: '',
  referenceNo: '',
  notes: '',
  attachments: [],
};

const INITIAL_FILE_FORM = { referenceNo: '', notes: '', filedAt: '' };

function toDateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function TypeBadge({ type }) {
  const cls = TYPE_BADGE[type] || TYPE_BADGE.other;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {type === 'other' ? 'Other' : type}
    </span>
  );
}

function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] || STATUS_BADGE.pending;
  const label = status === 'filed' ? 'Filed' : status === 'overdue' ? 'Overdue' : 'Pending';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

export default function ComplianceCalendarPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ overdue: 0, dueSoon30: 0, filedThisYear: 0 });

  const [activeTab, setActiveTab] = useState('upcoming');
  const [typeFilter, setTypeFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [fileTarget, setFileTarget] = useState(null);
  const [fileForm, setFileForm] = useState(INITIAL_FILE_FORM);
  const [isFiling, setIsFiling] = useState(false);

  const [isDeleting, setIsDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tab = TABS.find((t) => t.key === activeTab) || TABS[1];
      const qs = new URLSearchParams();
      if (tab.status) qs.set('status', tab.status);
      if (typeFilter) qs.set('type', typeFilter);
      const res = await fetch(`/api/organization/compliance?${qs.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load compliance items');
      setItems(data.items || []);
      setCounts(data.counts || { overdue: 0, dueSoon30: 0, filedThisYear: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, typeFilter]);

  useEffect(() => {
    if (!authLoading && isAdmin) load();
  }, [authLoading, isAdmin, load]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm(INITIAL_FORM);
    setShowForm(true);
  }, []);

  const openEdit = useCallback((item) => {
    setEditingItem(item);
    setForm({
      title: item.title || '',
      type: TYPE_OPTIONS.includes(item.type) ? item.type : 'other',
      description: item.description || '',
      dueDate: toDateInputValue(item.dueDate),
      recurrence: item.recurrence || 'none',
      assignedTo: item.assignedTo || '',
      referenceNo: item.referenceNo || '',
      notes: item.notes || '',
      attachments: Array.isArray(item.attachments)
        ? item.attachments.map((a) => ({ name: a?.name || '', url: a?.url || '' }))
        : [],
    });
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError(null);
      setSuccessMsg(null);
      setIsSaving(true);
      try {
        const payload = {
          ...form,
          attachments: form.attachments.filter((a) => a.name.trim() || a.url.trim()),
        };
        const url = editingItem
          ? `/api/organization/compliance/${editingItem._id}`
          : '/api/organization/compliance';
        const res = await fetch(url, {
          method: editingItem ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save');
        setShowForm(false);
        setEditingItem(null);
        setForm(INITIAL_FORM);
        await load();
      } catch (e2) {
        setError(e2.message);
      } finally {
        setIsSaving(false);
      }
    },
    [form, editingItem, load]
  );

  const openMarkFiled = useCallback((item) => {
    setFileTarget(item);
    setFileForm({ referenceNo: item.referenceNo || '', notes: '', filedAt: toDateInputValue(new Date()) });
  }, []);

  const handleMarkFiled = useCallback(
    async (e) => {
      e.preventDefault();
      if (!fileTarget) return;
      setError(null);
      setSuccessMsg(null);
      setIsFiling(true);
      try {
        const res = await fetch(`/api/organization/compliance/${fileTarget._id}/file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(fileForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to mark filed');
        const next = data.nextOccurrence;
        setSuccessMsg(
          next
            ? `"${data.item?.title || fileTarget.title}" marked filed. Next occurrence auto-created, due ${formatBusinessDate(next.dueDate)}.`
            : `"${data.item?.title || fileTarget.title}" marked filed.`
        );
        setFileTarget(null);
        setFileForm(INITIAL_FILE_FORM);
        await load();
      } catch (e2) {
        setError(e2.message);
      } finally {
        setIsFiling(false);
      }
    },
    [fileTarget, fileForm, load]
  );

  const handleDelete = useCallback(
    async (item) => {
      if (!confirm(`Delete "${item.title}"? It will be removed from the calendar.`)) return;
      setError(null);
      setSuccessMsg(null);
      setIsDeleting(item._id);
      try {
        const res = await fetch(`/api/organization/compliance/${item._id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete');
        await load();
      } catch (e2) {
        setError(e2.message);
      } finally {
        setIsDeleting(null);
      }
    },
    [load]
  );

  const setAttachment = (idx, key, value) => {
    setForm((f) => {
      const attachments = f.attachments.map((a, i) => (i === idx ? { ...a, [key]: value } : a));
      return { ...f, attachments };
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-10 w-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <UnauthorizedAccess />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-slate-600 mb-6" aria-label="Breadcrumb">
          <Link href="/console" className="hover:text-indigo-600 transition-colors">
            Console
          </Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <Link href="/organization" className="hover:text-indigo-600 transition-colors">
            Organization
          </Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <Link href="/organization/finance" className="hover:text-indigo-600 transition-colors">
            Finance
          </Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <span className="text-slate-900 font-medium">Compliance</span>
        </nav>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-1 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                Compliance Calendar
              </h1>
            </div>
            <p className="text-slate-600 ml-3">
              GST, TDS, Income Tax, ROC, FCRA, PF and ESI filings with due dates and reminders
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={load}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 transition-all"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Filing</span>
            </button>
          </div>
        </div>

        {/* Error / success banners */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 flex items-center gap-3 border border-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="hover:bg-red-100 rounded-lg p-1 transition-colors"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 text-green-800 flex items-center gap-3 border border-green-200">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">{successMsg}</span>
            <button
              onClick={() => setSuccessMsg(null)}
              className="hover:bg-green-100 rounded-lg p-1 transition-colors"
              aria-label="Dismiss message"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 border border-red-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <div className="text-3xl font-bold text-red-700">{counts.overdue}</div>
              <div className="text-sm text-slate-600">Overdue</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <CalendarClock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="text-3xl font-bold text-amber-700">{counts.dueSoon30}</div>
              <div className="text-sm text-slate-600">Due in 30 days</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-green-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <FileCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-3xl font-bold text-green-700">{counts.filedThisYear}</div>
              <div className="text-sm text-slate-600">Filed this year</div>
            </div>
          </div>
        </div>

        {/* Tabs + type filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-700 font-medium'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border-2 border-slate-200 text-slate-700 focus:border-indigo-400 focus:outline-none"
            aria-label="Filter by type"
          >
            <option value="">All types</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t === 'other' ? 'Other' : t}
              </option>
            ))}
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
            <p className="text-slate-600">Loading compliance items...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-300">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <CalendarClock className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Nothing here</h3>
            <p className="text-slate-600 mb-6">
              {activeTab === 'overdue'
                ? 'No overdue filings. Well done.'
                : activeTab === 'filed'
                  ? 'No filings have been marked as filed yet.'
                  : 'No compliance items match the current filters.'}
            </p>
            <button
              onClick={openCreate}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-5 h-5" />
              Add Filing
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 font-medium">Filing</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Due date</th>
                    <th className="px-4 py-3 font-medium">Assigned to</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 flex items-center gap-2">
                          {item.title}
                          {Array.isArray(item.attachments) && item.attachments.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 text-xs text-slate-500"
                              title={`${item.attachments.length} attachment(s)`}
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              {item.attachments.length}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.description}</div>
                        )}
                        {item.derivedStatus === 'filed' && item.filedAt && (
                          <div className="text-xs text-green-700 mt-0.5">
                            Filed {formatBusinessDate(item.filedAt)}
                            {item.referenceNo ? ` • Ref ${item.referenceNo}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={item.type} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-800">
                        {formatBusinessDate(item.dueDate)}
                        {item.recurrence && item.recurrence !== 'none' && (
                          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Repeat className="w-3 h-3" />
                            {RECURRENCE_LABEL[item.recurrence] || item.recurrence}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.assignedTo || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.derivedStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {item.derivedStatus !== 'filed' && (
                            <button
                              onClick={() => openMarkFiled(item)}
                              className="px-2.5 py-1.5 rounded-lg text-green-700 hover:bg-green-50 border border-transparent hover:border-green-200 flex items-center gap-1.5 transition-colors"
                              title="Mark filed"
                            >
                              <FileCheck className="w-4 h-4" />
                              <span className="hidden lg:inline text-xs font-medium">Mark filed</span>
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(item)}
                            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            disabled={isDeleting === item._id}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                            title="Delete"
                          >
                            {isDeleting === item._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-900">
                {editingItem ? 'Edit Filing' : 'Add Filing'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingItem(null);
                  setForm(INITIAL_FORM);
                }}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. GSTR-3B for June 2026"
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t === 'other' ? 'Other' : t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due date *</label>
                  <input
                    type="date"
                    required
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Recurrence</label>
                  <select
                    value={form.recurrence}
                    onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="none">One-time</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assigned to</label>
                  <input
                    type="text"
                    maxLength={200}
                    value={form.assignedTo}
                    onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
                    placeholder="Person responsible"
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reference no.</label>
                  <input
                    type="text"
                    maxLength={200}
                    value={form.referenceNo}
                    onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))}
                    placeholder="ARN / acknowledgement no."
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Attachments (links)</label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) =>
                        f.attachments.length >= 20
                          ? f
                          : { ...f, attachments: [...f.attachments, { name: '', url: '' }] }
                      )
                    }
                    className="text-xs px-2 py-1 rounded-lg text-indigo-700 hover:bg-indigo-50 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add link
                  </button>
                </div>
                {form.attachments.length === 0 ? (
                  <p className="text-xs text-slate-500">No attachments. Add links to acknowledgements or challans.</p>
                ) : (
                  <div className="space-y-2">
                    {form.attachments.map((a, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          maxLength={200}
                          value={a.name}
                          onChange={(e) => setAttachment(idx, 'name', e.target.value)}
                          placeholder="Name"
                          className="w-1/3 px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none text-sm"
                        />
                        <input
                          type="url"
                          maxLength={1000}
                          value={a.url}
                          onChange={(e) => setAttachment(idx, 'url', e.target.value)}
                          placeholder="https://..."
                          className="flex-1 px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              attachments: f.attachments.filter((_, i) => i !== idx),
                            }))
                          }
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                          aria-label="Remove attachment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingItem(null);
                    setForm(INITIAL_FORM);
                  }}
                  className="px-4 py-2 rounded-xl bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 flex items-center gap-2 disabled:opacity-50 transition-all"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingItem ? 'Save changes' : 'Create filing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark filed modal */}
      {fileTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Mark as filed</h2>
              <button
                onClick={() => {
                  setFileTarget(null);
                  setFileForm(INITIAL_FILE_FORM);
                }}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleMarkFiled} className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-medium text-slate-900 flex items-center gap-2">
                  {fileTarget.title} <TypeBadge type={fileTarget.type} />
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  Due {formatBusinessDate(fileTarget.dueDate)}
                </div>
                {fileTarget.recurrence && fileTarget.recurrence !== 'none' && (
                  <div className="text-xs text-indigo-700 mt-1 flex items-center gap-1">
                    <Repeat className="w-3.5 h-3.5" />
                    Recurring ({RECURRENCE_LABEL[fileTarget.recurrence] || fileTarget.recurrence}) — the next
                    occurrence will be created automatically.
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Filed on</label>
                <input
                  type="date"
                  value={fileForm.filedAt}
                  onChange={(e) => setFileForm((f) => ({ ...f, filedAt: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference no.</label>
                <input
                  type="text"
                  maxLength={200}
                  value={fileForm.referenceNo}
                  onChange={(e) => setFileForm((f) => ({ ...f, referenceNo: e.target.value }))}
                  placeholder="ARN / acknowledgement no."
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={fileForm.notes}
                  onChange={(e) => setFileForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFileTarget(null);
                    setFileForm(INITIAL_FILE_FORM);
                  }}
                  className="px-4 py-2 rounded-xl bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isFiling}
                  className="px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 transition-all"
                >
                  {isFiling ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                  Mark filed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
