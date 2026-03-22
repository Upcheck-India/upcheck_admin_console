'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MoreHorizontal, Edit2, Trash2, Shield, Info, FolderInput, X, Folder } from 'lucide-react';

// ─── Rename Modal ─────────────────────────────────────────────────────────────

function RenameModal({ folder, onConfirm, onClose }) {
  const [name, setName] = useState(folder.name);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Select all text on open
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Folder name cannot be empty.');
    if (trimmed === folder.name) return onClose();
    onConfirm(folder, trimmed);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Folder className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Rename Folder</h3>
              <p className="text-xs text-gray-400 truncate max-w-[180px]">{folder.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Folder name"
            className={`w-full px-3.5 py-2.5 text-sm border rounded-xl outline-none transition-all ${
              error
                ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200'
                : 'border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
            }`}
          />
          {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}

          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Rename
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ folder, onConfirm, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 animate-modal-in">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
              <Trash2 className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Delete Folder?</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                <span className="font-semibold text-gray-700">"{folder.name}"</span> and all files and subfolders inside it will be permanently deleted. This cannot be undone.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(folder); onClose(); }}
            className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-sm"
          >
            Delete folder
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FolderContextMenu ────────────────────────────────────────────────────────

export default function FolderContextMenu({
  folder,
  onRename,
  onDelete,
  onPermissions,
  onDetails,
  onCreateSubfolder,
}) {
  const [showMenu,         setShowMenu]         = useState(false);
  const [showRenameModal,  setShowRenameModal]  = useState(false);
  const [showDeleteModal,  setShowDeleteModal]  = useState(false);
  const menuRef   = useRef(null);
  const buttonRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          buttonRef.current && !buttonRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  // Close on Escape
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => { if (e.key === 'Escape') setShowMenu(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showMenu]);

  const safe = (fn, ...args) => (e) => {
    e.stopPropagation();
    setShowMenu(false);
    if (typeof fn === 'function') fn(...args);
  };

  const menuItems = [
    {
      icon: FolderInput,
      label: 'New Subfolder',
      fn: safe(onCreateSubfolder, folder),
      cls: 'text-gray-700',
    },
    {
      icon: Edit2,
      label: 'Rename',
      fn: (e) => { e.stopPropagation(); setShowMenu(false); setShowRenameModal(true); },
      cls: 'text-gray-700',
    },
    {
      icon: Shield,
      label: 'Permissions',
      fn: safe(onPermissions, folder),
      cls: 'text-gray-700',
    },
    {
      icon: Info,
      label: 'Details',
      fn: safe(onDetails, folder),
      cls: 'text-gray-700',
    },
    null, // divider
    {
      icon: Trash2,
      label: 'Delete',
      fn: (e) => { e.stopPropagation(); setShowMenu(false); setShowDeleteModal(true); },
      cls: 'text-red-600',
    },
  ];

  return (
    <>
      <style>{`
        @keyframes menu-in {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-menu-in { animation: menu-in 0.13s cubic-bezier(0.16, 1, 0.3, 1); }

        @keyframes modal-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-modal-in { animation: modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>

      <div className="relative" onClick={e => e.stopPropagation()}>
        {/* Trigger */}
        <button
          ref={buttonRef}
          onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
          className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${
            showMenu
              ? 'bg-gray-200 text-gray-700'
              : 'text-gray-400 hover:bg-gray-200 hover:text-gray-700'
          }`}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* Dropdown */}
        {showMenu && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 animate-menu-in"
          >
            {menuItems.map((item, i) =>
              item === null ? (
                <div key={`d-${i}`} className="border-t border-gray-100 my-1" />
              ) : (
                <button
                  key={item.label}
                  onClick={item.fn}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm ${item.cls} hover:bg-gray-50 transition-colors`}
                >
                  <item.icon className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  {item.label}
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {showRenameModal && (
        <RenameModal
          folder={folder}
          onConfirm={onRename}
          onClose={() => { setShowRenameModal(false); setNewName?.(folder.name); }}
        />
      )}

      {/* Delete Confirm Modal */}
      {showDeleteModal && (
        <DeleteModal
          folder={folder}
          onConfirm={onDelete}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
}