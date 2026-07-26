import { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, AlertCircle, Loader2, PieChart as PieIcon, TrendingUp, Target, DollarSign, X, Eye, CornerUpRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { EXPENSE_TYPES } from '../../funds/_components/constants';
import BudgetDetails from './BudgetDetails';

const BUDGET_TYPES = [
  { value: 'annual_fiscal', label: 'Annual Fiscal Budget' },
  { value: 'project', label: 'Project Budget' },
  { value: 'monthly', label: 'Monthly Budget' },
  { value: 'service', label: 'Service Budget' },
  { value: 'custom', label: 'Custom Budget' },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// ---- Fiscal year helpers (mirror the server's normalizeFiscalYear) ----
const fyLabel = (start) => `FY${start}-${String((start + 1) % 100).padStart(2, '0')}`;
const parseFyStart = (v) => {
  if (v == null) return null;
  const m = String(v).trim().match(/^(?:FY\s*)?(\d{4})/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1990 && n <= 2100 ? n : null;
};

// ---- Approval workflow (STATIC tailwind class maps — never interpolated) ----
const WORKFLOW_STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600 border border-slate-200',
  submitted: 'bg-blue-50 text-blue-700 border border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  locked: 'bg-purple-50 text-purple-700 border border-purple-200',
};
const WORKFLOW_STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved', locked: 'Locked' };
const WORKFLOW_ACTIONS = {
  draft: [
    { next: 'submitted', label: 'Submit', confirmText: 'Submit this budget for approval', style: 'border-blue-200 text-blue-700 hover:bg-blue-50' },
  ],
  submitted: [
    { next: 'draft', label: 'Withdraw', confirmText: 'Withdraw this budget back to draft', style: 'border-slate-200 text-slate-600 hover:bg-slate-50' },
    { next: 'approved', label: 'Approve', confirmText: 'Approve this budget', style: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
  ],
  approved: [
    { next: 'draft', label: 'Reopen', confirmText: 'Reopen this budget for editing (clears the approval)', style: 'border-slate-200 text-slate-600 hover:bg-slate-50' },
    { next: 'locked', label: 'Lock', confirmText: 'Lock this budget', style: 'border-purple-200 text-purple-700 hover:bg-purple-50' },
  ],
  locked: [
    { next: 'approved', label: 'Unlock', confirmText: 'Unlock this budget back to approved', style: 'border-purple-200 text-purple-700 hover:bg-purple-50' },
  ],
};

export default function BudgetPlanningEnhanced({ accountId, disabled }) {
  const [budgets, setBudgets] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filterType, setFilterType] = useState(''); // 'actual' or 'mock'
  const [filterFyStart, setFilterFyStart] = useState(''); // fiscal year filter ('' = all)
  const [showDetails, setShowDetails] = useState(false);
  const [detailsItem, setDetailsItem] = useState(null);
  const [carryforwardFrom, setCarryforwardFrom] = useState(null); // source budget for carryforward create
  const [form, setForm] = useState({
    name: '',
    fiscalYear: fyLabel(new Date().getFullYear()),
    fiscalYearStart: new Date().getFullYear(),
    type: 'actual',
    budgetType: 'annual_fiscal',
    categories: [],
    linkedGrants: [],
    baseAmount: null,
    notes: '',
  });

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ accountId });
      if (filterType) params.append('type', filterType);
      if (filterFyStart) params.append('fiscalYearStart', filterFyStart);
      const res = await fetch(`/api/organization/budgets?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load budgets');
      const data = await res.json();
      setBudgets(data.budgets || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accountId, filterType, filterFyStart]);

  const loadGrants = useCallback(async () => {
    if (!accountId) return;
    try {
      const res = await fetch(`/api/organization/grant-applications?accountId=${accountId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load grants');
      const data = await res.json();
      setGrants(data.applications || []);
    } catch (e) {
      console.error('Failed to load grants', e);
    }
  }, [accountId]);

  useEffect(() => {
    load();
    loadGrants();
  }, [load, loadGrants]);

  // Available balance for 'available' scope type
  const [availableBalance, setAvailableBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  useEffect(() => {
    const fetchBalance = async () => {
      if (!accountId) return;
      if (form.type !== 'available') return;
      // When editing, baseAmount is a snapshot taken at creation — never
      // re-seed it from the live balance (the server ignores it on PUT too).
      if (editingItem) return;
      try {
        setBalanceLoading(true);
        const res = await fetch(`/api/organization/funds?accountId=${accountId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const bal = data.summary?.balance ?? 0;
          setAvailableBalance(bal);
          setForm((f) => ({ ...f, baseAmount: bal }));
        }
      } finally {
        setBalanceLoading(false);
      }
    };
    fetchBalance();
  }, [form.type, accountId, editingItem]);

  const availableGrants = useMemo(() => {
    if (form.type === 'actual') {
      return grants.filter(g => g.status === 'granted');
    }
    return grants; // mock budgets can use all grants
  }, [grants, form.type]);

  const selectedGrantsTotal = useMemo(() => {
    return form.linkedGrants.reduce((sum, gid) => {
      const g = grants.find(gr => gr._id === gid);
      return sum + (g?.amount || 0);
    }, 0);
  }, [form.linkedGrants, grants]);

  const handleAdd = () => {
    setEditingItem(null);
    setCarryforwardFrom(null);
    const start = new Date().getFullYear();
    setForm({
      name: '',
      fiscalYear: fyLabel(start),
      fiscalYearStart: start,
      type: 'actual',
      budgetType: 'annual_fiscal',
      categories: EXPENSE_TYPES.map(t => ({ category: t.value, categoryLabel: t.label, allocated: 0, notes: '' })),
      linkedGrants: [],
      baseAmount: null,
      notes: '',
    });
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setCarryforwardFrom(null);
    const start = item.fiscalYearStart ?? parseFyStart(item.fiscalYear) ?? new Date().getFullYear();
    setForm({
      name: item.name || '',
      fiscalYear: item.fiscalYear || fyLabel(start),
      fiscalYearStart: start,
      type: item.type || 'actual',
      budgetType: item.budgetType || 'annual_fiscal',
      categories: item.categories || [],
      linkedGrants: item.linkedGrants || [],
      baseAmount: item.baseAmount ?? null,
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  // Open the create modal pre-filled with a budget's per-category remaining
  // amounts (allocated − actual, floored at 0) for the following fiscal year.
  const handleCarryForward = (item) => {
    setEditingItem(null);
    setCarryforwardFrom(item);
    const nextStart = (item.fiscalYearStart ?? parseFyStart(item.fiscalYear) ?? new Date().getFullYear()) + 1;
    setForm({
      name: `${item.name || 'Budget'} (carried forward)`,
      fiscalYear: fyLabel(nextStart),
      fiscalYearStart: nextStart,
      type: item.type || 'actual',
      budgetType: item.budgetType || 'annual_fiscal',
      categories: (item.categories || []).map(c => {
        const alloc = Number(c.allocated) || 0;
        const actual = Number(c.actual) || 0;
        const remaining = c.remaining != null ? Number(c.remaining) : alloc - actual;
        return { category: c.category, categoryLabel: c.categoryLabel, allocated: Math.max(0, remaining), notes: c.notes || '' };
      }),
      linkedGrants: [],
      baseAmount: null,
      notes: '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = { ...form, accountId };
      if (!editingItem && carryforwardFrom) payload.carryforwardFromBudgetId = carryforwardFrom._id;
      const url = editingItem ? `/api/organization/budgets/${editingItem._id}` : '/api/organization/budgets';
      const method = editingItem ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save');
      }
      await load();
      setShowModal(false);
      setCarryforwardFrom(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Approval workflow transition (Submit / Withdraw / Approve / Reopen / Lock / Unlock)
  const transitionWorkflow = async (budget, next, confirmText) => {
    if (!confirm(`${confirmText}: "${budget.name}"?`)) return;
    try {
      const res = await fetch(`/api/organization/budgets/${budget._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workflowStatus: next }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update budget status');
      }
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this budget?')) return;
    try {
      const res = await fetch(`/api/organization/budgets/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete');
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const updateCategory = (idx, field, value) => {
    const next = [...form.categories];
    next[idx] = { ...next[idx], [field]: value };
    setForm({ ...form, categories: next });
  };

  const addCustomCategory = () => {
    const name = prompt('Enter custom category name:');
    if (!name || !name.trim()) return;
    setForm({ ...form, categories: [...form.categories, { category: name.trim().toLowerCase().replace(/\s+/g,'_'), categoryLabel: name.trim(), allocated: 0, notes: '' }] });
  };

  const removeCategory = (idx) => {
    const next = form.categories.filter((_, i) => i !== idx);
    setForm({ ...form, categories: next });
  };

  const totalAllocated = form.categories.reduce((sum, c) => sum + (Number(c.allocated) || 0), 0);

  const chartData = useMemo(() => {
    return form.categories
      .filter(c => (Number(c.allocated) || 0) > 0)
      .map(c => ({ name: c.categoryLabel || c.category, value: Number(c.allocated) || 0 }))
      .sort((a, b) => b.value - a.value);
  }, [form.categories]);

  // Year options for the FY picker/filter: a window around today plus any
  // years already present on loaded budgets (so legacy years stay selectable).
  const fyOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = new Set();
    for (let y = current - 5; y <= current + 5; y++) years.add(y);
    budgets.forEach(b => {
      const s = b.fiscalYearStart ?? parseFyStart(b.fiscalYear);
      if (s != null) years.add(s);
    });
    if (form.fiscalYearStart != null) years.add(form.fiscalYearStart);
    return Array.from(years).sort((a, b) => b - a);
  }, [budgets, form.fiscalYearStart]);

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span className="flex-1">{error}</span>
          <button className="text-sm" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm"
            disabled={disabled}
          >
            <option value="">All budgets</option>
            <option value="actual">Actual (Granted funds)</option>
            <option value="mock">Mock (All applications)</option>
            <option value="available">Available (Account balance)</option>
            <option value="custom">Custom amount</option>
          </select>
          <select
            value={filterFyStart}
            onChange={(e) => setFilterFyStart(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm"
            disabled={disabled}
          >
            <option value="">All fiscal years</option>
            {fyOptions.map((y) => (
              <option key={y} value={y}>{fyLabel(y)}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAdd}
          disabled={disabled}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Create Budget
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-500">Loading budgets...</div>
        ) : budgets.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center text-slate-500">
            No budgets yet. Create one to plan your fund allocation.
          </div>
        ) : (
          budgets.map((budget) => {
            const budgetTypeDef = BUDGET_TYPES.find(t => t.value === budget.budgetType);
            // Budget-vs-actual (from the enriched API response)
            const allocated = Number(budget.totalAllocated) || 0;
            const actual = Number(budget.totalActual) || 0;
            const remaining = budget.totalRemaining != null ? Number(budget.totalRemaining) : allocated - actual;
            const overBudget = actual > allocated;
            const spentPct = allocated > 0 ? Math.min(100, (actual / allocated) * 100) : (actual > 0 ? 100 : 0);
            // Approval workflow
            const status = budget.workflowStatus || 'draft';
            const workflowActions = WORKFLOW_ACTIONS[status] || [];
            const contentLocked = status === 'approved' || status === 'locked';
            return (
              <div key={budget._id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PieIcon className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-semibold text-slate-900">{budget.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    <span className={`text-xs px-2 py-1 rounded-full ${WORKFLOW_STATUS_STYLES[status] || WORKFLOW_STATUS_STYLES.draft}`}>
                      {WORKFLOW_STATUS_LABELS[status] || 'Draft'}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      budget.type === 'actual' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      budget.type === 'available' ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                      budget.type === 'custom' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                      'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {budget.type === 'actual' ? 'Actual' : budget.type === 'available' ? 'Available' : budget.type === 'custom' ? 'Custom' : 'Mock'}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-500 mb-1">{budget.fiscalYear} • {budgetTypeDef?.label || budget.budgetType}</div>
                {budget.carriedForwardFrom && (
                  <div className="text-[11px] text-teal-700 mb-1 flex items-center gap-1">
                    <CornerUpRight className="w-3 h-3" />
                    Carried forward from {budget.carriedForwardFrom.fiscalYear || 'a previous budget'}
                  </div>
                )}
                <div className="text-2xl font-bold text-slate-900 mb-2">₹{(budget.totalAllocated || 0).toLocaleString()}</div>
                {/* Budget vs actual */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">
                      Spent: <span className={`font-semibold ${overBudget ? 'text-red-600' : 'text-slate-700'}`}>₹{actual.toLocaleString()}</span>
                    </span>
                    <span className={`font-semibold ${remaining < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {remaining < 0 ? `Over by ₹${Math.abs(remaining).toLocaleString()}` : `₹${remaining.toLocaleString()} left`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${overBudget ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${spentPct}%` }}
                    />
                  </div>
                  {budget.totalVariancePct != null && (
                    <div className={`mt-1 text-[11px] ${overBudget ? 'text-red-600' : 'text-slate-500'}`}>
                      Variance: {budget.totalVariancePct > 0 ? '+' : ''}{budget.totalVariancePct}% vs allocated
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-500 mb-3">
                  {(budget.categories || []).length} categories
                  {budget.linkedGrants?.length > 0 && ` • ${budget.linkedGrants.length} linked grants`}
                </div>
                {workflowActions.length > 0 && (
                  <div className="flex items-center gap-1 mb-2">
                    {workflowActions.map((a) => (
                      <button
                        key={a.next}
                        onClick={() => transitionWorkflow(budget, a.next, a.confirmText)}
                        className={`flex-1 px-2 py-1 text-xs font-medium rounded-lg border ${a.style}`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <button onClick={() => { setDetailsItem(budget); setShowDetails(true); }} className="flex-1 px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1">
                    <Eye className="w-4 h-4" /> View
                  </button>
                  <button
                    onClick={() => handleCarryForward(budget)}
                    title="Carry forward remaining amounts to a new budget"
                    className="px-3 py-1.5 rounded-lg border border-teal-200 text-teal-600 hover:bg-teal-50"
                  >
                    <CornerUpRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(budget)}
                    disabled={contentLocked}
                    title={contentLocked ? 'Reopen the budget to edit' : 'Edit budget'}
                    className="px-3 py-1.5 rounded-lg border text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(budget._id)}
                    disabled={contentLocked}
                    title={contentLocked ? 'Reopen the budget to delete' : 'Delete budget'}
                    className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {budget.createdBy?.username && (
                  <div className="mt-2 pt-2 border-t text-xs text-slate-500">Created by {budget.createdBy.username}</div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold">{editingItem ? 'Edit Budget' : 'Create Budget'}</h3>
              <button className="text-slate-500 hover:text-slate-700" onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1">
              {carryforwardFrom && !editingItem && (
                <div className="mb-4 p-3 rounded-xl bg-teal-50 border border-teal-200 text-sm text-teal-800 flex items-center gap-2">
                  <CornerUpRight className="w-4 h-4 shrink-0" />
                  <span>
                    Carrying forward remaining amounts from <span className="font-semibold">{carryforwardFrom.name}</span>
                    {carryforwardFrom.fiscalYear ? ` (${carryforwardFrom.fiscalYear})` : ''}. Adjust allocations as needed before saving.
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Budget Name *</label>
                  <input required className="w-full border rounded-lg px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., FY2024 Operational Budget" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fiscal Year *</label>
                  <select
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.fiscalYearStart ?? ''}
                    onChange={(e) => {
                      const start = parseInt(e.target.value, 10);
                      setForm({ ...form, fiscalYearStart: start, fiscalYear: fyLabel(start) });
                    }}
                  >
                    {fyOptions.map((y) => (
                      <option key={y} value={y}>{fyLabel(y)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Scope Type *</label>
                  <select required className="w-full border rounded-lg px-3 py-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="actual">Actual (Granted funds only)</option>
                    <option value="mock">Mock (All applications)</option>
                    <option value="available">Available (Account balance)</option>
                    <option value="custom">Custom amount</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Budget Type *</label>
                  <select required className="w-full border rounded-lg px-3 py-2" value={form.budgetType} onChange={(e) => setForm({ ...form, budgetType: e.target.value })}>
                    {BUDGET_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea rows={2} className="w-full border rounded-lg px-3 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>

              {/* Scope-specific inputs */}
              {form.type === 'available' && (
                <div className="border rounded-xl p-4 mb-4 bg-emerald-50 border-emerald-200">
                  <div className="font-semibold text-emerald-900 mb-1">
                    {editingItem ? 'Scope Amount: Balance snapshot (at creation)' : 'Scope Amount: Current Account Balance'}
                  </div>
                  <div className="text-sm text-emerald-700">
                    {editingItem
                      ? `₹${(Number(form.baseAmount) || 0).toLocaleString()}`
                      : balanceLoading ? 'Loading balance...' : `₹${(availableBalance || 0).toLocaleString()}`}
                  </div>
                  <div className="text-xs text-emerald-700 mt-1">
                    {editingItem
                      ? 'This snapshot was taken when the budget was created and is not changed by edits.'
                      : 'This budget will reference the current available funds in the selected billing account.'}
                  </div>
                </div>
              )}
              {form.type === 'custom' && (
                <div className="border rounded-xl p-4 mb-4 bg-indigo-50 border-indigo-200">
                  <label className="block text-sm font-medium mb-1">Scope Amount (Custom)</label>
                  <input type="number" className="w-64 border rounded px-3 py-2" value={form.baseAmount ?? ''} onChange={(e) => setForm({ ...form, baseAmount: e.target.value })} placeholder="0" />
                  <div className="text-xs text-indigo-700 mt-1">Enter the total funds you want to plan against.</div>
                </div>
              )}

              {/* Available Grants (only for actual/mock) */}
              {(form.type === 'actual' || form.type === 'mock') && availableGrants.length > 0 && (
                <div className="border rounded-xl p-4 mb-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Available Grants ({form.type === 'actual' ? 'Granted only' : 'All'})
                    </div>
                    <div className="text-sm text-slate-600">Selected: ₹{selectedGrantsTotal.toLocaleString()}</div>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {availableGrants.map(g => (
                      <label key={g._id} className="flex items-center gap-2 p-2 rounded hover:bg-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.linkedGrants.includes(g._id)}
                          onChange={(e) => {
                            if (e.target.checked) setForm({...form, linkedGrants: [...form.linkedGrants, g._id]});
                            else setForm({...form, linkedGrants: form.linkedGrants.filter(id => id !== g._id)});
                          }}
                          className="accent-emerald-600"
                        />
                        <div className="flex-1 text-sm">
                          <div className="font-medium">{g.programName}</div>
                          <div className="text-xs text-slate-500">{g.organizationName} • ₹{g.amount.toLocaleString()}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Allocations */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Category Allocations
                  </h4>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={addCustomCategory} className="text-sm px-3 py-1 rounded border text-indigo-600 hover:bg-indigo-50">+ Add Custom</button>
                    <div className="text-sm text-slate-600">Total: <span className="font-bold text-emerald-600">₹{totalAllocated.toLocaleString()}</span></div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {form.categories.map((cat, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded border bg-slate-50">
                        <div className="flex-1 text-sm font-medium text-slate-700">{cat.categoryLabel || cat.category}</div>
                        <input
                          type="number"
                          className="w-32 border rounded px-2 py-1 text-sm"
                          value={cat.allocated}
                          onChange={(e) => updateCategory(idx, 'allocated', e.target.value)}
                          placeholder="0"
                        />
                        <button type="button" onClick={() => removeCategory(idx)} className="p-1 hover:bg-red-50 text-red-600 rounded">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie data={chartData} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label={(entry) => `${entry.name}: ₹${entry.value.toLocaleString()}`}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-sm text-slate-500">Allocation visualization will appear here</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? 'Saving...' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budget Details Modal */}
      {showDetails && detailsItem && (
        <BudgetDetails
          budget={detailsItem}
          grants={grants}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
}
