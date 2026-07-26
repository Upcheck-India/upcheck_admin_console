'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import UnauthorizedAccess from '../../../components/UnauthorizedAccess';
import useOnlineUsers from '../../../hooks/useOnlineUsers';
import {
  Plus,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  X,
  Loader2,
  ChevronDown,
  Search,
  Pencil,
  Trash2,
  Target,
} from 'lucide-react';

import OrgNavbar from '../funds/_components/Navbar';
import { numberFmt } from '../funds/_components/constants';
import useBillingAccount from '../funds/_hooks/useBillingAccount';

const PRESETS = [
  { v: 'today', l: 'Today' },
  { v: 'last7', l: 'Last 7 days' },
  { v: 'thisWeek', l: 'This week' },
  { v: 'thisMonth', l: 'This month' },
  { v: 'last30', l: 'Last 30 days' },
  { v: 'thisQuarter', l: 'This quarter' },
  { v: 'thisYear', l: 'This year' },
  { v: 'custom', l: 'Custom' },
];

const INITIAL_FORM = {
  code: '',
  name: '',
  owner: '',
  description: '',
  budgetAmount: '',
  active: true,
};

export default function CostCentersPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');
  const onlineUsers = useOnlineUsers();
  const { accounts } = useBillingAccount();

  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [summary, setSummary] = useState(null);

  const [datePreset, setDatePreset] = useState('thisYear');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) setUsername(storedUsername);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ includeInactive: 'true' });
      if (accountId) params.set('accountId', accountId);
      if (datePreset === 'custom') {
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
      } else if (datePreset) {
        params.set('datePreset', datePreset);
      }
      const res = await fetch(`/api/organization/cost-centers?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load cost centers');
      setItems(Array.isArray(data.items) ? data.items : []);
      setUnmatched(Array.isArray(data.unmatched) ? data.unmatched : []);
      setSummary(data.summary || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accountId, datePreset, startDate, endDate]);

  useEffect(() => {
    if (!authLoading && isAdmin) load();
  }, [authLoading, isAdmin, load]);

  const handleLogout = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        localStorage.removeItem('username');
        sessionStorage.clear();
        window.location.href = '/login';
      }
    } catch (e) {
      console.error('Logout failed:', e);
    }
  }, []);

  const handleAddNew = useCallback(() => {
    setEditingItem(null);
    setForm(INITIAL_FORM);
    setFormError(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((item) => {
    setEditingItem(item);
    setForm({
      code: item.code || '',
      name: item.name || '',
      owner: item.owner || '',
      description: item.description || '',
      budgetAmount: item.budgetAmount != null ? String(item.budgetAmount) : '',
      active: item.active !== false,
    });
    setFormError(null);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditingItem(null);
    setForm(INITIAL_FORM);
    setFormError(null);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        owner: form.owner.trim(),
        description: form.description.trim(),
        budgetAmount: form.budgetAmount === '' ? null : Number(form.budgetAmount),
        active: !!form.active,
      };
      const url = editingItem
        ? `/api/organization/cost-centers/${editingItem._id}`
        : '/api/organization/cost-centers';
      const res = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save cost center');
      closeForm();
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  }, [form, editingItem, closeForm, load]);

  const handleDelete = useCallback(async (item) => {
    if (!confirm(`Delete cost center ${item.code}? Its ledger spend will show up as unassigned.`)) return;
    setDeletingId(item._id);
    setError(null);
    try {
      const res = await fetch(`/api/organization/cost-centers/${item._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete cost center');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  }, [load]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.code, i.name, i.owner].some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [items, search]);

  const codeValid = /^[A-Z0-9_-]{1,20}$/i.test(form.code.trim());

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="relative">
          <div className="h-12 w-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-0 h-12 w-12 border-3 border-indigo-200 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isAdmin) return <UnauthorizedAccess />;

  const hasData = items.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <OrgNavbar
        title="Cost Centers"
        backHref="/organization/finance"
        onlineUsers={onlineUsers}
        user={user}
        username={username}
        onLogout={handleLogout}
      />

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-slate-600 mb-6" aria-label="Breadcrumb">
          <Link href="/console" className="hover:text-indigo-600 transition-colors">Console</Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <Link href="/organization" className="hover:text-indigo-600 transition-colors">Organization</Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <Link href="/organization/finance" className="hover:text-indigo-600 transition-colors">Finance</Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <span className="text-slate-900 font-medium">Cost Centers</span>
        </nav>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div className="h-8 w-1 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                Cost Centers
              </h1>
            </div>
            <p className="text-slate-600 ml-3">
              Budget vs actual spend by cost center
              {hasData && (
                <span className="ml-2 text-slate-500">
                  • {items.length} center{items.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="border rounded-xl px-3 py-2 text-sm bg-white"
              title="Billing account"
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="border rounded-xl px-3 py-2 text-sm bg-white"
              title="Date range for actual spend"
            >
              {PRESETS.map((p) => (
                <option key={p.v} value={p.v}>{p.l}</option>
              ))}
            </select>
            {datePreset === 'custom' && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border rounded-xl px-3 py-2 text-sm bg-white"
                  title="Start date"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border rounded-xl px-3 py-2 text-sm bg-white"
                  title="End date"
                />
              </>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 transition-all"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleAddNew}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
              title="Add cost center"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Cost Center</span>
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 flex items-center gap-3 border border-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="hover:bg-red-100 rounded-lg p-1 transition-colors" aria-label="Dismiss error">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Total Budget</p>
              <p className="text-2xl font-bold text-slate-900">{numberFmt(summary.totalBudget)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Actual Spend</p>
              <p className="text-2xl font-bold text-slate-900">{numberFmt(summary.totalActual)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Remaining</p>
              <p className={`text-2xl font-bold ${summary.totalRemaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {numberFmt(summary.totalRemaining)}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Over Budget</p>
              <p className={`text-2xl font-bold ${summary.overBudgetCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {summary.overBudgetCount} center{summary.overBudgetCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-4 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by code, name or owner..."
              className="w-full pl-10 pr-3 py-2 border rounded-xl bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Content */}
        {loading && !hasData ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
            <p className="text-slate-600">Loading cost centers...</p>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-300">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Target className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No cost centers yet</h3>
            <p className="text-slate-600 mb-6">Create cost centers to track budget vs actual spend from fund allocations</p>
            <button
              onClick={handleAddNew}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-5 h-5" />
              Add First Cost Center
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-600 border-b border-slate-200">
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Owner</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Budget</th>
                    <th className="px-4 py-3 font-medium text-right">Actual</th>
                    <th className="px-4 py-3 font-medium text-right">Remaining</th>
                    <th className="px-4 py-3 font-medium text-right">Variance</th>
                    <th className="px-4 py-3 font-medium w-40">Utilization</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleItems.map((item) => {
                    const overBudget = item.budget > 0 && item.actual > item.budget;
                    const pct = item.budget > 0 ? Math.min((item.actual / item.budget) * 100, 100) : 0;
                    return (
                      <tr key={item._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900">{item.code}</td>
                        <td className="px-4 py-3 text-slate-800">
                          {item.name}
                          {item.description ? (
                            <span className="block text-xs text-slate-500 truncate max-w-[16rem]" title={item.description}>
                              {item.description}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.owner || '—'}</td>
                        <td className="px-4 py-3">
                          {item.active !== false ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-800">
                          {item.budget > 0 ? numberFmt(item.budget) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">{numberFmt(item.actual)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${item.budget > 0 ? (item.remaining < 0 ? 'text-red-600' : 'text-emerald-600') : 'text-slate-400'}`}>
                          {item.budget > 0 ? numberFmt(item.remaining) : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right ${item.variancePct == null ? 'text-slate-400' : item.variancePct > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {item.variancePct == null ? '—' : `${item.variancePct > 0 ? '+' : ''}${item.variancePct}%`}
                        </td>
                        <td className="px-4 py-3">
                          {item.budget > 0 ? (
                            <div className="w-36">
                              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-2 rounded-full ${overBudget ? 'bg-red-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                {Math.round((item.actual / item.budget) * 100)}% used
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">No budget</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              disabled={deletingId === item._id}
                              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              {deletingId === item._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleItems.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                        No cost centers match your search
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Unassigned cost-center spend */}
        {unmatched.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900">Unassigned cost-center spend</h3>
                <p className="text-sm text-amber-700">
                  These allocation labels from the funds ledger do not match any cost center code or name.
                  Create a matching cost center or fix the entries to categorize this spend.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b border-slate-200">
                    <th className="px-5 py-3 font-medium">Allocation label</th>
                    <th className="px-5 py-3 font-medium text-right">Entries</th>
                    <th className="px-5 py-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unmatched.map((u) => (
                    <tr key={u.key} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-mono text-slate-800">{u.key}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{u.entries}</td>
                      <td className="px-5 py-3 text-right font-medium text-slate-900">{numberFmt(u.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold">{editingItem ? 'Edit Cost Center' : 'Add Cost Center'}</h3>
              <button className="text-slate-500 hover:text-slate-700" onClick={closeForm}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-center gap-2 border border-red-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Code</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="mt-1 w-full border rounded px-3 py-2 font-mono uppercase"
                    placeholder="e.g., OPS"
                    maxLength={20}
                    required
                  />
                  {form.code && !codeValid && (
                    <p className="text-xs text-red-600 mt-1">1-20 letters, digits, _ or - only</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Budget (INR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.budgetAmount}
                    onChange={(e) => setForm((f) => ({ ...f, budgetAmount: e.target.value }))}
                    className="mt-1 w-full border rounded px-3 py-2"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2"
                  placeholder="e.g., Operations"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Owner</label>
                <input
                  value={form.owner}
                  onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2"
                  placeholder="Responsible person / team"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2"
                  rows={3}
                  placeholder="Optional"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                Active
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeForm} className="px-4 py-2 rounded border">Cancel</button>
                <button
                  type="submit"
                  disabled={isSaving || !codeValid || !form.name.trim()}
                  className={`px-4 py-2 rounded text-white ${isSaving || !codeValid || !form.name.trim() ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} flex items-center gap-2`}
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
