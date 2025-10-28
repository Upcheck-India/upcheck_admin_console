import { Plus } from 'lucide-react';

export default function AccountSelector({ accounts, activeAccountId, onSelect, onAdd }) {
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
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
    </div>
  );
}
