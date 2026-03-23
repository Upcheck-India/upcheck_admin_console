'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MoreHorizontal, Edit2, Trash2, Shield, Info, FolderInput, X, Folder } from 'lucide-react';
import FolderDeleteConfirmModal from './FolderDeleteConfirmModal';

// ─── Folder Action Modal (Centered Dialog) ────────────────────────────────────

function FolderActionModal({ folder, onClose, onRename, onDelete, onPermissions, onDetails, onCreateSubfolder }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Folder className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Folder Options</h3>
              <p className="text-xs text-gray-500 truncate max-w-[200px]">{folder.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          <button
            onClick={() => { onCreateSubfolder(folder); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <FolderInput className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">New Subfolder</p>
              <p className="text-xs text-gray-500">Create a new folder inside this one</p>
            </div>
          </button>

          <button
            onClick={() => { onRename(folder); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Edit2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Rename</p>
              <p className="text-xs text-gray-500">Change the folder name</p>
            </div>
          </button>

          <button
            onClick={() => { onPermissions(folder); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Permissions</p>
              <p className="text-xs text-gray-500">Manage who can access this folder</p>
            </div>
          </button>

          <button
            onClick={() => { onDetails(folder); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Info className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Details</p>
              <p className="text-xs text-gray-500">View folder information</p>
            </div>
          </button>

          <div className="border-t border-gray-100 my-2" />

          <button
            onClick={() => { onDelete(folder); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 transition-colors text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0 group-hover:bg-red-100">
              <Trash2 className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-600">Delete</p>
              <p className="text-xs text-gray-500">Permanently delete this folder</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

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
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
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
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
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
  onMassMove,
}) {
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleRename = (f) => {
    const newName = prompt('Enter new folder name:', f.name);
    if (newName && newName.trim() && newName !== f.name) {
      onRename(f, newName.trim());
    }
  };

  const handleDeleteClick = (f) => {
    setShowDeleteConfirm(true);
    setShowModal(false);
  };

  const handleConfirmDelete = (f) => {
    onDelete(f);
  };

  const handleMassMove = (f, preview) => {
    onMassMove?.(f, preview);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-modal-in { animation: modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>

      <div className="relative" onClick={e => e.stopPropagation()}>
        {/* Trigger */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
          className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${
            showModal
              ? 'bg-gray-200 text-gray-700'
              : 'text-gray-400 hover:bg-gray-200 hover:text-gray-700'
          }`}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Folder Action Modal */}
      {showModal && (
        <FolderActionModal
          folder={folder}
          onClose={() => setShowModal(false)}
          onRename={handleRename}
          onDelete={handleDeleteClick}
          onPermissions={onPermissions}
          onDetails={onDetails}
          onCreateSubfolder={onCreateSubfolder}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <FolderDeleteConfirmModal
          folder={folder}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleConfirmDelete}
          onMassMove={handleMassMove}
        />
      )}
    </>
  );
}