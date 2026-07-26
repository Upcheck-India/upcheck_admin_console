'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import UnauthorizedAccess from '../../../components/UnauthorizedAccess';
import { numberFmt } from '../funds/_components/constants';
import { formatBusinessDate } from '../../../lib/finance/dates';
import {
  Plus,
  RefreshCw,
  AlertCircle,
  X,
  Loader2,
  Search,
  Pencil,
  Trash2,
  Archive,
  Eye,
  Package,
} from 'lucide-react';

const ASSET_CATEGORIES = [
  { value: 'computer', label: 'Computers & IT' },
  { value: 'furniture', label: 'Furniture & Fixtures' },
  { value: 'vehicle', label: 'Vehicles' },
  { value: 'machinery', label: 'Machinery & Equipment' },
  { value: 'office_equipment', label: 'Office Equipment' },
  { value: 'software', label: 'Software Licenses' },
  { value: 'building', label: 'Buildings & Improvements' },
  { value: 'other', label: 'Other' },
];

const categoryLabel = (v) => ASSET_CATEGORIES.find((c) => c.value === v)?.label || v || 'Other';

// Static class map — never build tailwind classes from template strings.
const STATUS_BADGE = {
  active: 'bg-emerald-100 text-emerald-800',
  disposed: 'bg-gray-200 text-gray-600',
};

const INITIAL_FORM = {
  name: '',
  category: 'other',
  accountId: '',
  purchaseDate: '',
  cost: '',
  salvageValue: '',
  usefulLifeMonths: '60',
  assignedTo: '',
  location: '',
  serialNumber: '',
  notes: '',
  tagsText: '',
};

const EMPTY_SUMMARY = {
  totalCost: 0,
  totalAccumulatedDepreciation: 0,
  totalNetBookValue: 0,
  assetCount: 0,
  activeCount: 0,
  disposedCount: 0,
};

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent || 'text-gray-900'}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-gray-400">{sub}</p> : null}
    </div>
  );
}

export default function FixedAssetsPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [accounts, setAccounts] = useState([]);

  const [filters, setFilters] = useState({ status: '', category: '', search: '' });

  // Create / edit modal
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Dispose modal
  const [disposeItem, setDisposeItem] = useState(null);
  const [disposeDate, setDisposeDate] = useState('');
  const [disposeNotes, setDisposeNotes] = useState('');
  const [disposeError, setDisposeError] = useState(null);
  const [isDisposing, setIsDisposing] = useState(false);

  // Detail (depreciation schedule) modal
  const [detailItem, setDetailItem] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);
      const res = await fetch(`/api/organization/assets?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to load assets');
      }
      const data = await res.json();
      setItems(data.items || []);
      setSummary(data.summary || EMPTY_SUMMARY);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Debounced load whenever filters change (search input keystrokes included).
  useEffect(() => {
    if (!isAdmin) return undefined;
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load, isAdmin]);

  // Accounts for the optional "linked account" select in the form.
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await fetch('/api/organization/accounts', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setAccounts(data.accounts || []);
      } catch {
        /* non-fatal */
      }
    })();
  }, [isAdmin]);

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...INITIAL_FORM, purchaseDate: new Date().toISOString().slice(0, 10) });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name || '',
      category: item.category || 'other',
      accountId: item.accountId || '',
      purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toISOString().slice(0, 10) : '',
      cost: item.cost != null ? String(item.cost) : '',
      salvageValue: item.salvageValue != null ? String(item.salvageValue) : '',
      usefulLifeMonths: item.usefulLifeMonths != null ? String(item.usefulLifeMonths) : '',
      assignedTo: item.assignedTo || '',
      location: item.location || '',
      serialNumber: item.serialNumber || '',
      notes: item.notes || '',
      tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const isEditingDisposed = editingItem?.status === 'disposed';

  const submitForm = async (e) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      // Disposed assets: only notes / assigned to / location are editable.
      const payload = isEditingDisposed
        ? { notes: form.notes, assignedTo: form.assignedTo, location: form.location }
        : {
            name: form.name,
            category: form.category,
            accountId: form.accountId || null,
            purchaseDate: form.purchaseDate,
            cost: form.cost,
            salvageValue: form.salvageValue === '' ? 0 : form.salvageValue,
            usefulLifeMonths: form.usefulLifeMonths,
            method: 'straight_line',
            assignedTo: form.assignedTo,
            location: form.location,
            serialNumber: form.serialNumber,
            notes: form.notes,
            tags: form.tagsText.split(',').map((t) => t.trim()).filter(Boolean),
          };
      const url = editingItem ? `/api/organization/assets/${editingItem._id}` : '/api/organization/assets';
      const res = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save asset');
      }
      setShowForm(false);
      setEditingItem(null);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to save asset');
    } finally {
      setIsSaving(false);
    }
  };

  const openDispose = (item) => {
    setDisposeItem(item);
    setDisposeDate(new Date().toISOString().slice(0, 10));
    setDisposeNotes('');
    setDisposeError(null);
  };

  const submitDispose = async () => {
    if (!disposeItem) return;
    setDisposeError(null);
    setIsDisposing(true);
    try {
      const res = await fetch(`/api/organization/assets/${disposeItem._id}?dispose=true`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dispose: true, disposedAt: disposeDate || undefined, disposalNotes: disposeNotes }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to dispose asset');
      }
      setDisposeItem(null);
      await load();
    } catch (err) {
      setDisposeError(err.message || 'Failed to dispose asset');
    } finally {
      setIsDisposing(false);
    }
  };

  const deleteAsset = async (item) => {
    if (!window.confirm(`Delete "${item.name}"? The asset is removed from the register (recoverable by an administrator).`)) return;
    setDeletingId(item._id);
    try {
      const res = await fetch(`/api/organization/assets/${item._id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to delete asset');
      }
      await load();
    } catch (err) {
      setError(err.message || 'Failed to delete asset');
    } finally {
      setDeletingId(null);
    }
  };

  const openDetail = async (item) => {
    setDetailItem({ ...item, schedule: null });
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/organization/assets/${item._id}`, { credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to load asset details');
      }
      const data = await res.json();
      setDetailItem(data);
    } catch (err) {
      setError(err.message || 'Failed to load asset details');
      setDetailItem(null);
    } finally {
      setDetailLoading(false);
    }
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

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="h-7 w-7 text-indigo-600" /> Fixed Assets
            </h1>
            <p className="text-gray-600 mt-1">Asset register with straight-line depreciation and net book values</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Add asset
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="Total cost" value={numberFmt(summary.totalCost)} sub={`${summary.activeCount} active asset${summary.activeCount === 1 ? '' : 's'}`} />
          <SummaryCard label="Accumulated depreciation" value={numberFmt(summary.totalAccumulatedDepreciation)} accent="text-amber-600" />
          <SummaryCard label="Net book value" value={numberFmt(summary.totalNetBookValue)} accent="text-emerald-600" />
          <SummaryCard label="Assets" value={`${summary.activeCount} active`} sub={`${summary.disposedCount} disposed · ${summary.assetCount} total`} />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name or serial number…"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className={`${inputCls} pl-9`}
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="disposed">Disposed</option>
          </select>
          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All categories</option>
            {ASSET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No assets found</p>
              <p className="text-gray-400 text-sm mt-1">
                {filters.search || filters.status || filters.category
                  ? 'Try adjusting your filters.'
                  : 'Add your first asset to start tracking depreciation.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Asset</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchased</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Accum. dep.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Net book value</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned to</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        {item.serialNumber ? <p className="text-xs text-gray-400">SN: {item.serialNumber}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{categoryLabel(item.category)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatBusinessDate(item.purchaseDate)}</td>
                      <td className="px-4 py-3 text-right text-gray-900 whitespace-nowrap">{numberFmt(item.cost)}</td>
                      <td className="px-4 py-3 text-right text-amber-600 whitespace-nowrap">{numberFmt(item.accumulatedDepreciation)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-emerald-700 font-medium">{numberFmt(item.netBookValue)}</span>
                        <p className="text-xs text-gray-400">{item.monthsElapsed}/{item.usefulLifeMonths} mo</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[item.status] || STATUS_BADGE.active}`}>
                          {item.status === 'disposed' ? 'Disposed' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.assignedTo || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openDetail(item)} title="Depreciation schedule" className="p-1.5 rounded-md text-gray-500 hover:text-indigo-600 hover:bg-indigo-50">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => openEdit(item)} title="Edit" className="p-1.5 rounded-md text-gray-500 hover:text-indigo-600 hover:bg-indigo-50">
                            <Pencil className="h-4 w-4" />
                          </button>
                          {item.status !== 'disposed' && (
                            <button onClick={() => openDispose(item)} title="Dispose" className="p-1.5 rounded-md text-gray-500 hover:text-amber-600 hover:bg-amber-50">
                              <Archive className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteAsset(item)}
                            title="Delete"
                            disabled={deletingId === item._id}
                            className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            {deletingId === item._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create / edit modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 sticky top-0 bg-white">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingItem ? (isEditingDisposed ? 'Edit disposed asset' : 'Edit asset') : 'Add asset'}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={submitForm} className="p-5 space-y-4">
                {formError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {formError}
                  </div>
                )}
                {isEditingDisposed && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    This asset is disposed — only notes, assigned to and location can be changed.
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Name *</label>
                    <input type="text" required value={form.name} disabled={isEditingDisposed}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Category</label>
                    <select value={form.category} disabled={isEditingDisposed}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls}>
                      {ASSET_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Linked account (optional)</label>
                    <select value={form.accountId} disabled={isEditingDisposed}
                      onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))} className={inputCls}>
                      <option value="">None</option>
                      {accounts.map((a) => (
                        <option key={a._id} value={a._id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Purchase date *</label>
                    <input type="date" required={!isEditingDisposed} value={form.purchaseDate} disabled={isEditingDisposed}
                      onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Cost (INR) *</label>
                    <input type="number" min="0.01" step="0.01" required={!isEditingDisposed} value={form.cost} disabled={isEditingDisposed}
                      onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Salvage value (INR)</label>
                    <input type="number" min="0" step="0.01" value={form.salvageValue} disabled={isEditingDisposed}
                      onChange={(e) => setForm((f) => ({ ...f, salvageValue: e.target.value }))} className={inputCls}
                      placeholder="0.00" />
                  </div>
                  <div>
                    <label className={labelCls}>Useful life (months) *</label>
                    <input type="number" min="1" max="600" step="1" required={!isEditingDisposed} value={form.usefulLifeMonths} disabled={isEditingDisposed}
                      onChange={(e) => setForm((f) => ({ ...f, usefulLifeMonths: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Depreciation method</label>
                    <input type="text" value="Straight line" disabled className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Serial number</label>
                    <input type="text" value={form.serialNumber} disabled={isEditingDisposed}
                      onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Assigned to</label>
                    <input type="text" value={form.assignedTo}
                      onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Location</label>
                    <input type="text" value={form.location}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Tags (comma separated)</label>
                    <input type="text" value={form.tagsText} disabled={isEditingDisposed}
                      onChange={(e) => setForm((f) => ({ ...f, tagsText: e.target.value }))} className={inputCls}
                      placeholder="laptop, engineering" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Notes</label>
                    <textarea rows={3} value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputCls} />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingItem ? 'Save changes' : 'Add asset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dispose modal */}
        {disposeItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-gray-900">Dispose asset</h2>
                <button onClick={() => setDisposeItem(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {disposeError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {disposeError}
                  </div>
                )}
                <p className="text-sm text-gray-600">
                  Mark <span className="font-medium text-gray-900">{disposeItem.name}</span> as disposed?
                  Depreciation stops at the disposal date and the asset&apos;s financial details become read-only.
                </p>
                <div>
                  <label className={labelCls}>Disposal date</label>
                  <input type="date" value={disposeDate} onChange={(e) => setDisposeDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Disposal notes (optional)</label>
                  <textarea rows={3} value={disposeNotes} onChange={(e) => setDisposeNotes(e.target.value)} className={inputCls}
                    placeholder="Sold, scrapped, donated…" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setDisposeItem(null)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={submitDispose} disabled={isDisposing}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60">
                    {isDisposing && <Loader2 className="h-4 w-4 animate-spin" />}
                    Dispose asset
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detail / schedule modal */}
        {detailItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{detailItem.name}</h2>
                  <p className="text-xs text-gray-500">
                    {categoryLabel(detailItem.category)} · purchased {formatBusinessDate(detailItem.purchaseDate)}
                    {detailItem.status === 'disposed' && detailItem.disposedAt
                      ? ` · disposed ${formatBusinessDate(detailItem.disposedAt)}`
                      : ''}
                  </p>
                </div>
                <button onClick={() => setDetailItem(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Cost</p>
                        <p className="text-sm font-semibold text-gray-900">{numberFmt(detailItem.cost)}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Salvage value</p>
                        <p className="text-sm font-semibold text-gray-900">{numberFmt(detailItem.salvageValue)}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Accum. depreciation</p>
                        <p className="text-sm font-semibold text-amber-600">{numberFmt(detailItem.accumulatedDepreciation)}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Net book value</p>
                        <p className="text-sm font-semibold text-emerald-600">{numberFmt(detailItem.netBookValue)}</p>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 mb-2">
                      Straight-line over {detailItem.usefulLifeMonths} months
                      {detailItem.monthlyDepreciation != null ? ` · ~${numberFmt(detailItem.monthlyDepreciation)} / month` : ''}
                      {' '}· {detailItem.monthsElapsed}/{detailItem.usefulLifeMonths} months elapsed
                    </div>

                    {Array.isArray(detailItem.schedule) && detailItem.schedule.length > 0 ? (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="max-h-80 overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Month</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Depreciation</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Accumulated</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Net book value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {detailItem.schedule.map((row, i) => (
                                <tr key={row.month} className={i < detailItem.monthsElapsed ? 'bg-emerald-50/40' : ''}>
                                  <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{row.month}</td>
                                  <td className="px-4 py-2 text-right text-gray-700 whitespace-nowrap">{numberFmt(row.depreciation)}</td>
                                  <td className="px-4 py-2 text-right text-amber-600 whitespace-nowrap">{numberFmt(row.accumulated)}</td>
                                  <td className="px-4 py-2 text-right text-emerald-700 whitespace-nowrap">{numberFmt(row.netBookValue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 py-4 text-center">No depreciation periods to show.</p>
                    )}

                    {(detailItem.assignedTo || detailItem.location || detailItem.notes || detailItem.disposalNotes) && (
                      <div className="mt-4 space-y-1 text-sm text-gray-600">
                        {detailItem.assignedTo ? <p><span className="text-gray-400">Assigned to:</span> {detailItem.assignedTo}</p> : null}
                        {detailItem.location ? <p><span className="text-gray-400">Location:</span> {detailItem.location}</p> : null}
                        {detailItem.notes ? <p><span className="text-gray-400">Notes:</span> {detailItem.notes}</p> : null}
                        {detailItem.disposalNotes ? <p><span className="text-gray-400">Disposal notes:</span> {detailItem.disposalNotes}</p> : null}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
