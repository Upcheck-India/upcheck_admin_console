'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

// A small "..." dropdown of message actions, shared across DM/Team/Group
// message bubbles. `actions` = [{ icon, label, onClick, danger? }]. Skips
// rendering entirely if there are no actions to show.
export default function MessageActionMenu({ actions, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (!actions || actions.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(s => !s)}
        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
        title="More actions"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          className={`absolute z-30 top-full mt-1 ${align === 'right' ? 'right-0' : 'left-0'} w-44 bg-white border border-slate-100 rounded-xl shadow-lg py-1`}
        >
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setOpen(false); action.onClick(); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors ${
                action.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {action.icon && <action.icon className="w-3.5 h-3.5 flex-shrink-0" />}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
