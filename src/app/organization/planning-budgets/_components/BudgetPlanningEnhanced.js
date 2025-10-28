import { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, AlertCircle, Loader2, PieChart as PieIcon, TrendingUp, Target, DollarSign, X, Eye } from 'lucide-react';
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

export default function BudgetPlanningEnhanced({ accountId, disabled }) {
  const [budgets, setBudgets] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filterType, setFilterType] = useState(''); // 'actual' or 'mock'
  const [showDetails, setShowDetails] = useState(false);
  const [detailsItem, setDetailsItem] = useState(null);
  const [form, setForm] = useState({
    name: '',
    fiscalYear: new Date().getFullYear().toString(),
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
      const res = await fetch(`/api/organization/budgets?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load budgets');
      const data = await res.json();
      setBudgets(data.budgets || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accountId, filterType]);

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
  }, [form.type, accountId]);

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
    setForm({
      name: '',
      fiscalYear: new Date().getFullYear().toString(),
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
    setForm({
      name: item.name || '',
      fiscalYear: item.fiscalYear || new Date().getFullYear().toString(),
      type: item.type || 'actual',
      budgetType: item.budgetType || 'annual_fiscal',
      categories: item.categories || [],
      linkedGrants: item.linkedGrants || [],
      baseAmount: item.baseAmount ?? null,
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = { ...form, accountId };
      const url = editingItem ? `/api/organization/budgets/${editingItem._id}` : '/api/organization/budgets';
      const method = editingItem ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save');
      }
      await load();
      setShowModal(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSaving(false);
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
      <div className="flex items-center justify-between mb-4">
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
            return (
              <div key={budget._id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PieIcon className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-semibold text-slate-900">{budget.name}</h3>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    budget.type === 'actual' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    budget.type === 'available' ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                    budget.type === 'custom' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                    'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {budget.type === 'actual' ? 'Actual' : budget.type === 'available' ? 'Available' : budget.type === 'custom' ? 'Custom' : 'Mock'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mb-1">FY {budget.fiscalYear} • {budgetTypeDef?.label || budget.budgetType}</div>
                <div className="text-2xl font-bold text-slate-900 mb-2">₹{(budget.totalAllocated || 0).toLocaleString()}</div>
                <div className="text-xs text-slate-500 mb-3">
                  {(budget.categories || []).length} categories
                  {budget.linkedGrants?.length > 0 && ` • ${budget.linkedGrants.length} linked grants`}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setDetailsItem(budget); setShowDetails(true); }} className="flex-1 px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1">
                    <Eye className="w-4 h-4" /> View
                  </button>
                  <button onClick={() => handleEdit(budget)} className="px-3 py-1.5 rounded-lg border text-indigo-600 hover:bg-indigo-50">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(budget._id)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
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
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Budget Name *</label>
                  <input required className="w-full border rounded-lg px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., FY2024 Operational Budget" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fiscal Year *</label>
                  <input required className="w-full border rounded-lg px-3 py-2" value={form.fiscalYear} onChange={(e) => setForm({ ...form, fiscalYear: e.target.value })} />
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
                  <div className="font-semibold text-emerald-900 mb-1">Scope Amount: Current Account Balance</div>
                  <div className="text-sm text-emerald-700">{balanceLoading ? 'Loading balance...' : `₹${(availableBalance || 0).toLocaleString()}`}</div>
                  <div className="text-xs text-emerald-700 mt-1">This budget will reference the current available funds in the selected billing account.</div>
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
