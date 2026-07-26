import { Plus } from 'lucide-react';

// Prop contract (unchanged, used by finance hub, funds, reports, cost-centers):
//   { accounts, activeAccountId, onSelect, onAdd }
// Enhancement is additive: each option shows the currency and (when present) the
// masked bank number, and an optional "New" button appears when onAdd is given.
export default function AccountSelector({ accounts, activeAccountId, onSelect, onAdd }) {
  const optionLabel = (a) => {
    const parts = [a.name];
    if (a.currency && a.currency !== 'INR') parts.push(a.currency);
    if (a.bank?.accountNumberMasked) parts.push(a.bank.accountNumberMasked);
    return parts.join(' · ');
  };

  const handleAdd = () => {
    if (!onAdd) return;
    const name = (typeof window !== 'undefined' ? window.prompt('New billing account name') : '') || '';
    const trimmed = name.trim();
    if (trimmed) onAdd(trimmed);
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={activeAccountId || ''}
        onChange={(e) => onSelect(e.target.value || null)}
        className="border rounded-xl px-3 py-2 text-sm bg-white"
        title="Billing account"
      >
        {(!accounts || accounts.length === 0) && <option value="">No accounts</option>}
        {accounts && accounts.map((a) => (
          <option key={a.id} value={a.id}>{optionLabel(a)}</option>
        ))}
      </select>
      {onAdd && (
        <button
          type="button"
          onClick={handleAdd}
          className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 flex items-center gap-1 text-sm"
          title="Add billing account"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New</span>
        </button>
      )}
    </div>
  );
}
