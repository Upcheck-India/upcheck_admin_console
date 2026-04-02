'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trash2, Lock, Info, Edit2, MoreHorizontal,
  Play, Lightbulb, Pause, Archive, XCircle, Check,
  Loader2, X, AlertCircle
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:    { label: 'Active',    Icon: Play,      color: 'text-emerald-600', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  ideation:  { label: 'Ideation',  Icon: Lightbulb, color: 'text-violet-600',  dot: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700 ring-violet-200'   },
  paused:    { label: 'Paused',    Icon: Pause,     color: 'text-amber-600',   dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 ring-amber-200'       },
  shelved:   { label: 'Shelved',   Icon: Archive,   color: 'text-slate-500',   dot: 'bg-slate-400',   badge: 'bg-slate-50 text-slate-600 ring-slate-200'       },
  archived:  { label: 'Archived',  Icon: Archive,   color: 'text-gray-500',    dot: 'bg-gray-400',    badge: 'bg-gray-50 text-gray-600 ring-gray-200'          },
  dismissed: { label: 'Dismissed', Icon: XCircle,   color: 'text-red-500',     dot: 'bg-red-400',     badge: 'bg-red-50 text-red-600 ring-red-200'             },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({ value, ...cfg }));


// ─── Edit Modal ───────────────────────────────────────────────────────────────


function EditModal({ project, onSave, onClose }) {
  const [name,        setName]        = useState(project.name || '');
  const [description, setDescription] = useState(project.description || '');
  const [status,      setStatus]      = useState(project.status || 'active');
  const [saving,      setSaving]      = useState(false);
  const [nameError,   setNameError]   = useState('');
  const nameRef = useRef(null);

  // Sync with project prop changes (external updates)
  useEffect(() => {
    setName(project.name || '');
    setDescription(project.description || '');
    setStatus(project.status || 'active');
  }, [project.name, project.description, project.status]);

  // Focus name input on open
  useEffect(() => { setTimeout(() => nameRef.current?.select(), 80); }, []);

  // Escape to close
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setNameError('Project name is required.'); return; }
    setNameError('');
    setSaving(true);
    try {
      await onSave(project, { name: trimmed, description: description.trim(), status });
      onClose();
    } catch {
      // onSave handles its own error reporting
    } finally {
      setSaving(false);
    }
  };

  const currentStatus = STATUS_CONFIG[status] || STATUS_CONFIG.active;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 animate-modal-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Edit Project</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[240px]">{project.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Project Name <span className="text-red-400">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setNameError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              className={`w-full px-3.5 py-2.5 text-sm border rounded-xl outline-none transition-all ${
                nameError
                  ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200'
                  : 'border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
              }`}
            />
            {nameError && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {nameError}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Description <span className="text-gray-300 font-normal normal-case">optional</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of the project…"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all resize-none"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Status
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {STATUS_OPTIONS.map(opt => {
                const active = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`relative flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 text-left transition-all ${
                      active
                        ? 'border-blue-400 bg-blue-50/70 shadow-sm'
                        : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
                    <span className={`text-xs font-semibold truncate ${active ? 'text-blue-700' : 'text-gray-600'}`}>
                      {opt.label}
                    </span>
                    {active && <Check className="w-3 h-3 text-blue-500 absolute top-1.5 right-1.5" />}
                  </button>
                );
              })}
            </div>
            {/* Preview badge */}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400">Preview:</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${currentStatus.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.dot}`} />
                {currentStatus.label}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
              : 'Save Changes'
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ProjectCardActions ───────────────────────────────────────────────────────

export default function ProjectCardActions({
  project,
  onEdit,
  onDelete,
  onPermissions,
  onDetails,
  onStatusChange,
  canManagePerms = false,
}) {
  const [showMenu,          setShowMenu]          = useState(false);
  const [showStatusSub,     setShowStatusSub]     = useState(false);
  const [showEditModal,     setShowEditModal]      = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const menuRef = useRef(null);
  const moreRef = useRef(null);

  const currentStatus = STATUS_CONFIG[project.status] || STATUS_CONFIG.active;

  // ── Outside click handlers ────────────────────────────────────────────────

  useEffect(() => {
    if (!showMenu) return;
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          moreRef.current && !moreRef.current.contains(e.target)) {
        setShowMenu(false);
        setShowDeleteConfirm(false);
        setShowStatusSub(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  // Escape closes everything
  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape') {
        setShowMenu(false);
        setShowStatusSub(false);
        setShowDeleteConfirm(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const stop = e => { e.preventDefault(); e.stopPropagation(); };

  const handleStatusSelect = (newStatus) => {
    setShowMenu(false);
    setShowStatusSub(false);
    if (typeof onStatusChange === 'function') onStatusChange(project, newStatus);
  };

  const handleDelete = () => {
    setShowMenu(false);
    setShowDeleteConfirm(false);
    if (typeof onDelete === 'function') onDelete(project);
  };

  const handleEdit = useCallback(async (proj, updates) => {
    if (typeof onEdit === 'function') await onEdit(proj, updates);
  }, [onEdit]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes menu-in {
          from { opacity:0; transform:scale(0.95) translateY(-4px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        .animate-menu-in { animation: menu-in 0.13s cubic-bezier(0.16,1,0.3,1); }
        @keyframes modal-in {
          from { opacity:0; transform:translateY(8px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .animate-modal-in { animation: modal-in 0.2s cubic-bezier(0.16,1,0.3,1); }
      `}</style>

      {/* Single ⋯ button — no status pill, no extra icons */}
      <div className="relative" onClick={stop}>
        <button
          ref={moreRef}
          onClick={e => {
            stop(e);
            setShowMenu(v => !v);
            setShowStatusSub(false);
            setShowDeleteConfirm(false);
          }}
          title="More actions"
          className={`p-1.5 rounded-lg transition-colors ${
            showMenu ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
          }`}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {showMenu && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 animate-menu-in"
            onClick={stop}
          >
            {/* Change Status — inline expandable */}
            <div>
              <button
                onClick={() => { setShowStatusSub(v => !v); setShowDeleteConfirm(false); }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${currentStatus.dot}`} />
                <span className="flex-1 text-left">Change Status</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ring-1 ${currentStatus.badge}`}>
                  {currentStatus.label}
                </span>
              </button>

              {/* Inline status submenu */}
              {showStatusSub && (
                <div className="mx-2 mb-1 border border-gray-100 rounded-xl overflow-hidden">
                  {STATUS_OPTIONS.map(opt => {
                    const active = project.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleStatusSelect(opt.value)}
                        className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs transition-colors ${
                          active
                            ? 'bg-blue-50 text-blue-800 font-semibold'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${opt.dot}`} />
                        {opt.label}
                        {active && <Check className="w-3 h-3 text-blue-500 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Edit */}
            <button
              onClick={() => { setShowMenu(false); setShowEditModal(true); }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-gray-400" />
              Edit Project
            </button>

            {/* Permissions - only visible to users who can manage permissions */}
            {canManagePerms && (
              <button
                onClick={() => { setShowMenu(false); if (typeof onPermissions === 'function') onPermissions(project); }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Lock className="w-3.5 h-3.5 text-gray-400" />
                Permissions
              </button>
            )}

            {/* Details */}
            <button
              onClick={() => { setShowMenu(false); if (typeof onDetails === 'function') onDetails(project); }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Info className="w-3.5 h-3.5 text-gray-400" />
              View Details
            </button>

            <div className="border-t border-gray-100 my-1" />

            {/* Delete */}
            {!showDeleteConfirm ? (
              <button
                onClick={() => { setShowStatusSub(false); setShowDeleteConfirm(true); }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Project
              </button>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-600 leading-snug">
                    Delete <span className="font-semibold text-gray-800">"{project.name}"</span>? This cannot be undone.
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleDelete}
                    className="flex-1 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditModal
          project={project}
          onSave={handleEdit}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  );
}