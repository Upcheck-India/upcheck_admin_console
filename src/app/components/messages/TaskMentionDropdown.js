'use client';

import { Bookmark, Loader } from 'lucide-react';

const PRIORITY_COLOR = {
  Urgent: 'text-rose-600', High: 'text-orange-600', Medium: 'text-amber-600', Low: 'text-emerald-600',
};

// Autocomplete dropdown shown above the composer while the user is typing
// a "#task" mention. Positioned by the caller (absolute wrapper).
export default function TaskMentionDropdown({ loading, tasks, onSelect }) {
  if (!loading && tasks.length === 0) {
    return (
      <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-40">
        <p className="text-xs text-slate-400">No matching tasks. Keep typing, or this chat may not have a linked project.</p>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-40 max-h-64 overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      ) : (
        tasks.map(task => (
          <button
            key={task._id}
            type="button"
            onClick={() => onSelect(task)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="flex-1 text-xs font-semibold text-slate-800 truncate">{task.title}</span>
            <span className={`text-[10px] font-bold ${PRIORITY_COLOR[task.priority] || 'text-slate-400'}`}>{task.priority}</span>
          </button>
        ))
      )}
    </div>
  );
}
