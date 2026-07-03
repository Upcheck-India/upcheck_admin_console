'use client';

import { useState, useEffect } from 'react';
import { X, Loader, Bookmark, AlertCircle } from 'lucide-react';

const PRIORITY_COLOR = {
  Urgent: 'bg-rose-50 text-rose-700 border-rose-200',
  High: 'bg-orange-50 text-orange-700 border-orange-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// Quick-info popover for a clicked #task mention chip. Self-contained —
// fetches the task on open using the same permission-checked endpoint the
// mention itself was resolved against.
export default function TaskInfoModal({ taskId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!taskId) return;
    let active = true;
    setLoading(true);
    setError('');
    fetch(`/api/tasks/${taskId}/mention-info`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(data.error || 'Failed to load task');
          return;
        }
        setTask(data.task);
      })
      .catch(() => { if (active) setError('Failed to load task'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [taskId]);

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-100 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Bookmark className="w-4 h-4 text-amber-500" /> Task
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-amber-500" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        ) : task ? (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">{task.title}</h3>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORITY_COLOR[task.priority] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                {task.priority}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{task.status}</span>
              <span className="text-[10px] text-slate-400">{task.dueLabel}</span>
            </div>
            {task.description && <p className="text-xs text-slate-500 leading-relaxed">{task.description.slice(0, 300)}</p>}
            <div className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Assignees: </span>
              {task.assignees.length > 0 ? task.assignees.join(', ') : 'Unassigned'}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
