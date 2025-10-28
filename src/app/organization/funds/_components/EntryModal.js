import { X, Plus, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { CATEGORIES, INFLOW_TYPES, EXPENSE_TYPES } from './constants';

export default function EntryModal({ open, editingItem, form, setForm, onSubmit, onClose, isSaving }) {
  if (!open) return null;
  const isInflow = form.kind === 'in';
  const isOutflow = form.kind === 'out';
  const allocations = Array.isArray(form.allocations) ? form.allocations : [];

  const totalAlloc = allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const amountNum = Number(form.amount) || 0;
  const allocMismatch = isOutflow && allocations.length > 0 && amountNum > 0 && Math.abs(totalAlloc - amountNum) > 0.01;
  const typeMissing = (isInflow && !form.inflowType) || (isOutflow && !form.expenseType);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between shrink-0">
          <h3 className="text-lg font-semibold">{editingItem ? 'Edit Entry' : 'Add Entry'}</h3>
          <button className="text-slate-500 hover:text-slate-700" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Type</label>
              <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))} className="mt-1 w-full border rounded px-3 py-2">
                <option value="in">Received</option>
                <option value="out">Spent</option>
              </select>
            </div>
            {isInflow ? (
              <div>
                <label className="block text-sm font-medium text-slate-700">Inflow Category</label>
                <select value={form.inflowType || ''} onChange={(e) => setForm((f) => ({ ...f, inflowType: e.target.value }))} className="mt-1 w-full border rounded px-3 py-2" required>
                  <option value="">Select inflow type</option>
                  {INFLOW_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700">Expense Category</label>
                <select value={form.expenseType || ''} onChange={(e) => setForm((f) => ({ ...f, expenseType: e.target.value }))} className="mt-1 w-full border rounded px-3 py-2" required>
                  <option value="">Select expense type</option>
                  {EXPENSE_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Title</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="mt-1 w-full border rounded px-3 py-2" placeholder="e.g., Grant from XYZ Foundation" required />
          </div>
          {isInflow && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Restriction</label>
                <select value={form.fundRestriction || 'unrestricted'} onChange={(e) => setForm((f) => ({ ...f, fundRestriction: e.target.value }))} className="mt-1 w-full border rounded px-3 py-2">
                  <option value="unrestricted">Unrestricted</option>
                  <option value="restricted">Restricted</option>
                </select>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Source</label>
              <input value={form.source || ''} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} className="mt-1 w-full border rounded px-3 py-2" placeholder="Account / Instrument" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Counterparty</label>
              <input value={form.counterparty || ''} onChange={(e) => setForm((f) => ({ ...f, counterparty: e.target.value }))} className="mt-1 w-full border rounded px-3 py-2" placeholder="Donor / Vendor" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Reference</label>
            <input value={form.reference || ''} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} className="mt-1 w-full border rounded px-3 py-2" placeholder="Invoice/UTR/Cheque/PO#" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Amount (INR)</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1 w-full border rounded px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="mt-1 w-full border rounded px-3 py-2" />
            </div>
          </div>
          {isOutflow && (
            <div className="border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-slate-700">Allocations (optional)</div>
                <button type="button" className="px-2 py-1 text-xs bg-slate-100 rounded-lg hover:bg-slate-200 flex items-center gap-1" onClick={() => setForm((f) => ({ ...f, allocations: [...(f.allocations || []), { costCenter: '', project: '', amount: '' }] }))}>
                  <Plus className="w-3 h-3" /> Add split
                </button>
              </div>
              {(allocations.length === 0) ? (
                <p className="text-xs text-slate-500">No splits added. Entire amount will be attributed to default context.</p>
              ) : (
                <div className="space-y-2">
                  {allocations.map((a, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input className="col-span-4 border rounded px-2 py-1 text-sm" placeholder="Cost center" value={a.costCenter || ''} onChange={(e) => setForm((f) => { const arr = [...(f.allocations || [])]; arr[idx] = { ...arr[idx], costCenter: e.target.value }; return { ...f, allocations: arr }; })} />
                      <input className="col-span-4 border rounded px-2 py-1 text-sm" placeholder="Project" value={a.project || ''} onChange={(e) => setForm((f) => { const arr = [...(f.allocations || [])]; arr[idx] = { ...arr[idx], project: e.target.value }; return { ...f, allocations: arr }; })} />
                      <input type="number" min="0" step="0.01" className="col-span-3 border rounded px-2 py-1 text-sm" placeholder="Amount" value={a.amount || ''} onChange={(e) => setForm((f) => { const arr = [...(f.allocations || [])]; arr[idx] = { ...arr[idx], amount: e.target.value }; return { ...f, allocations: arr }; })} />
                      <button type="button" className="col-span-1 text-red-600 hover:bg-red-50 rounded p-1" onClick={() => setForm((f) => ({ ...f, allocations: allocations.filter((_, i) => i !== idx) }))}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="text-xs text-slate-600">Total allocated: {totalAlloc || 0} {allocMismatch && <span className="text-amber-700 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> mismatch with amount {amountNum || 0}</span>}</div>
                </div>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="mt-1 w-full border rounded px-3 py-2" rows={3} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Tags</label>
            <input value={form.tagsText || ''} onChange={(e) => setForm((f) => ({ ...f, tagsText: e.target.value }))} className="mt-1 w-full border rounded px-3 py-2" placeholder="Comma separated, e.g., grant,q4,csr" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
            <button type="submit" disabled={isSaving || typeMissing || allocMismatch} className={`px-4 py-2 rounded text-white ${isSaving || typeMissing || allocMismatch ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} flex items-center gap-2`}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
