import { Edit2, Trash2, Eye, Loader2, ArrowRightLeft } from 'lucide-react';
import { INFLOW_TYPES, EXPENSE_TYPES } from './constants';

export default function TransactionsTable({ items, numberFmt, onEdit, onDelete, onView, isDeleting }) {
  const inflowLabel = (v) => INFLOW_TYPES.find((t) => t.value === v)?.label || v || '-';
  const expenseLabel = (v) => EXPENSE_TYPES.find((t) => t.value === v)?.label || v || '-';
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="overflow-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Notes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">No entries</td>
              </tr>
            )}
            {items.map((it) => (
              <tr key={it._id}>
                <td className="px-4 py-3 text-sm text-slate-700">{new Date(it.date).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${it.kind === 'in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {it.kind === 'in' ? 'Received' : 'Spent'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{it.kind === 'in' ? inflowLabel(it.inflowType || it.category) : expenseLabel(it.expenseType || it.category)}</td>
                <td className="px-4 py-3 text-sm text-slate-900">
                  <div className="flex items-center gap-2">
                    {it.title}
                    {it.isTransfer && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200" title="Internal transfer from Untransferred Funds">
                        <ArrowRightLeft className="w-3 h-3" /> Transfer
                      </span>
                    )}
                  </div>
                </td>
                <td className={`px-4 py-3 text-sm font-semibold ${it.kind === 'in' ? 'text-green-700' : 'text-red-700'}`}>{numberFmt(it.amount)}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{it.notes || '-'}</td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 justify-end">
                    {onView && (
                      <button onClick={() => onView(it)} className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50 flex items-center gap-1">
                        <Eye className="w-4 h-4" /> View
                      </button>
                    )}
                    <button onClick={() => onEdit(it)} className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50 flex items-center gap-1">
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <button onClick={() => onDelete(it._id)} disabled={isDeleting === it._id} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1 disabled:opacity-50">
                      {isDeleting === it._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} {isDeleting === it._id ? 'Deleting' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
