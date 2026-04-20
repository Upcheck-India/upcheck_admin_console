'use client';

import React, { useState, useEffect } from 'react';
import { X, Trash2, Folder, FileText, AlertTriangle, Archive, Move } from 'lucide-react';

export default function FolderDeleteConfirmModal({ folder, onClose, onConfirm, onMassMove }) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (folder) {
      fetchPreview();
    }
  }, [folder]);

  const fetchPreview = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/documentation/folders/${folder._id}/preview-delete`);
      if (response.ok) {
        const data = await response.json();
        setPreview(data);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to load preview');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    onConfirm(folder);
  };

  const handleMassMove = () => {
    onMassMove(folder, preview);
  };

  if (!folder) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Delete Folder</h3>
              <p className="text-sm text-gray-600">This action will permanently delete:</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-12 bg-gray-100 rounded-xl" />
              <div className="h-8 bg-gray-100 rounded-xl" />
              <div className="h-8 bg-gray-100 rounded-xl" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          ) : preview ? (
            <>
              {/* Folder being deleted */}
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100 mb-4">
                <Folder className="w-6 h-6 text-red-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-red-900 truncate">{preview.folder.name}</p>
                  <p className="text-sm text-red-600 truncate">{preview.folder.path || '/'}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{preview.stats.totalFolders}</p>
                  <p className="text-xs text-gray-500">Folders</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{preview.stats.totalFiles}</p>
                  <p className="text-xs text-gray-500">Files</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{formatSize(preview.stats.totalSize)}</p>
                  <p className="text-xs text-gray-500">Total Size</p>
                </div>
              </div>

              {/* Subfolders preview */}
              {preview.subfolders.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    Subfolders ({preview.subfolders.length})
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {preview.subfolders.slice(0, 10).map((sub, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600 px-3 py-1.5 bg-gray-50 rounded-lg">
                        <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="truncate">{sub.name}</span>
                      </div>
                    ))}
                    {preview.subfolders.length > 10 && (
                      <p className="text-xs text-gray-400 text-center py-1">
                        +{preview.subfolders.length - 10} more...
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Files preview */}
              {preview.files.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Files ({preview.files.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {preview.files.slice(0, 10).map((file, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600 px-3 py-1.5 bg-gray-50 rounded-lg">
                        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="truncate flex-1">{file.name}</span>
                        <span className="text-xs text-gray-400">{formatSize(file.fileSize)}</span>
                      </div>
                    ))}
                    {preview.files.length > 10 && (
                      <p className="text-xs text-gray-400 text-center py-1">
                        +{preview.files.length - 10} more...
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  This action cannot be undone. All files and folders will be permanently deleted.
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Actions */}
        {!loading && !error && preview && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleMassMove}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
            >
              <Move className="w-4 h-4" />
              Move Contents Instead
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              Delete Everything
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
