'use client';

import { useState, useEffect } from 'react';
import { Folder, Check, Loader, Save } from 'lucide-react';

// Config editor for the Project Management plugin — lets a chat admin
// link (or unlink) the chat to one or more projects. Linking scopes
// /tasks, /todo, /duesoon, /overdue, and /sprints to those projects by
// default; unlinking (empty selection) leaves commands unscoped
// (falls back to "your own tasks across all projects").
export default function ProjectManagementConfig({ chatType, chatId, config, onSaved }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(() => {
    if (Array.isArray(config?.projectIds)) return config.projectIds;
    if (config?.projectId) return [config.projectId];
    return [];
  });

  useEffect(() => {
    fetch('/api/projects', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/chat-plugins/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chatType, chatId, pluginId: 'project-management', config: { projectIds: selected } }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      onSaved?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
        <Loader className="w-3.5 h-3.5 animate-spin" /> Loading projects...
      </div>
    );
  }

  return (
    <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
      <p className="text-[11px] font-bold text-slate-600 mb-2 flex items-center gap-1.5">
        <Folder className="w-3.5 h-3.5" /> Linked projects
      </p>
      <p className="text-[10px] text-slate-400 mb-2">
        Scopes /tasks, /todo, /duesoon, /overdue, and /sprints to these projects by default. Leave empty for unscoped (each person&apos;s own tasks across all projects).
      </p>
      {projects.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">No projects available.</p>
      ) : (
        <div className="max-h-40 overflow-y-auto space-y-1 mb-2">
          {projects.map(p => {
            const isSel = selected.includes(p._id);
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => toggle(p._id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white text-left transition-colors"
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center border ${isSel ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                  {isSel && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-xs text-slate-700 truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
      >
        {saving ? <Loader className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        Save
      </button>
    </div>
  );
}
