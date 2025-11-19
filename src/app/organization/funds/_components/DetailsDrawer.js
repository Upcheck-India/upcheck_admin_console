import { X } from 'lucide-react';
import { CATEGORIES, numberFmt } from './constants';

export default function DetailsDrawer({ open, item, onClose }) {
  if (!open || !item) return null;
  const cat = CATEGORIES.find((c) => c.value === item.category);
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">Entry Details</h3>
          <button className="text-slate-500 hover:text-slate-700" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          <DetailRow label="Date" value={new Date(item.date).toLocaleString()} />
          <DetailRow label="Type" value={item.kind === 'in' ? 'Received' : 'Spent'} badge={item.kind} />
          <DetailRow label="Amount" value={numberFmt(item.amount)} strong />
          <DetailRow label="Title" value={item.title} />
          <DetailRow label="Category" value={cat ? cat.label : (item.category || '-')} color={cat?.color} />
          <DetailRow label="Source" value={item.source || '-'} />
          <DetailRow label="Counterparty" value={item.counterparty || '-'} />
          <DetailRow label="Reference" value={item.reference || '-'} />
          <DetailRow label="Notes" value={item.notes || '-'} multiline />
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Tags</div>
            <div className="flex flex-wrap gap-2">
              {(item.tags || []).length ? (
                item.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200">{t}</span>
                ))
              ) : (
                <span className="text-slate-500 text-sm">No tags</span>
              )}
            </div>
          </div>
          <div className="text-xs text-slate-500 border-t pt-3">
            <div>Created: {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</div>
            {item.createdBy && (
              <div>By: {item.createdBy.username || item.createdBy.email}</div>
            )}
            {item.updatedAt && <div>Updated: {new Date(item.updatedAt).toLocaleString()}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, strong, multiline, badge, color }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">{label}</div>
      {badge ? (
        <span className={`px-2 py-1 rounded text-xs ${badge === 'in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {value}
        </span>
      ) : (
        <div className={`text-slate-800 ${strong ? 'font-semibold' : ''}`} style={color ? { display: 'inline-flex', alignItems: 'center', gap: 8 } : undefined}>
          {color && <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />}
          <span className={multiline ? 'whitespace-pre-wrap break-words' : ''}>{value}</span>
        </div>
      )}
    </div>
  );
}
