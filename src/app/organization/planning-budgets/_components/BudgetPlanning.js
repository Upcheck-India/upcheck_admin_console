import { useState, useCallback, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertCircle, Loader2, PieChart, TrendingUp } from 'lucide-react';
import { EXPENSE_TYPES } from '../../funds/_components/constants';

export default function BudgetPlanning({ accountId, disabled }) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filterType, setFilterType] = useState(''); // 'actual' or 'mock'
  const [form, setForm] = useState({
    name: '',
    fiscalYear: new Date().getFullYear().toString(),
    type: 'actual',
    categories: [],
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

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = () => {
    setEditingItem(null);
    setForm({
      name: '',
      fiscalYear: new Date().getFullYear().toString(),
      type: 'actual',
      categories: EXPENSE_TYPES.map(t => ({ category: t.value, allocated: 0, notes: '' })),
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
      categories: item.categories || [],
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

  const totalAllocated = form.categories.reduce((sum, c) => sum + (Number(c.allocated) || 0), 0);

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
          budgets.map((budget) => (
            <div key={budget._id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-slate-900">{budget.name}</h3>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${budget.type === 'actual' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {budget.type === 'actual' ? 'Actual' : 'Mock'}
                </span>
              </div>
              <div className="text-sm text-slate-600 mb-2">FY {budget.fiscalYear}</div>
              <div className="text-2xl font-bold text-slate-900 mb-3">₹{(budget.totalAllocated || 0).toLocaleString()}</div>
              <div className="text-xs text-slate-500 mb-3">{(budget.categories || []).length} categories</div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleEdit(budget)} className="flex-1 px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1">
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button onClick={() => handleDelete(budget._id)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold">{editingItem ? 'Edit Budget' : 'Create Budget'}</h3>
              <button className="text-slate-500 hover:text-slate-700" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Budget Name *</label>
                  <input required className="w-full border rounded-lg px-3 py-2" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="e.g., FY2024 Operational Budget" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fiscal Year *</label>
                  <input required className="w-full border rounded-lg px-3 py-2" value={form.fiscalYear} onChange={(e) => setForm({...form, fiscalYear: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type *</label>
                  <select required className="w-full border rounded-lg px-3 py-2" value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}>
                    <option value="actual">Actual (Granted funds only)</option>
                    <option value="mock">Mock (All applications)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea rows={2} className="w-full border rounded-lg px-3 py-2" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} />
                </div>
              </div>

              {/* Category Allocations */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-900">Category Allocations</h4>
                  <div className="text-sm text-slate-600">Total: <span className="font-bold text-emerald-600">₹{totalAllocated.toLocaleString()}</span></div>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {form.categories.map((cat, idx) => {
                    const expType = EXPENSE_TYPES.find(t => t.value === cat.category);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex-1 text-sm font-medium text-slate-700">{expType?.label || cat.category}</div>
                        <input
                          type="number"
                          className="w-32 border rounded px-2 py-1 text-sm"
                          value={cat.allocated}
                          onChange={(e) => updateCategory(idx, 'allocated', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    );
                  })}
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
    </div>
  );
}
