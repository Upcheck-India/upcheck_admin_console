'use client';

import { useState } from 'react';
import { X, Folder, Users } from 'lucide-react';
import PermissionManager from './PermissionManager';

export default function CreateFolderModal({ roomId, parentId, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [folderName, setFolderName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [createdFolderId, setCreatedFolderId] = useState(null);

  async function handleCreateFolder() {
    if (!folderName.trim()) {
      setError('Folder name is required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const response = await fetch('/api/dataroom/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderName,
          description,
          roomId,
          parentId: parentId || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCreatedFolderId(data._id);
        setStep(2);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create folder');
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
      setError('Failed to create folder');
    } finally {
      setCreating(false);
    }
  }

  function handleFinish() {
    onSuccess && onSuccess();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Folder className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">
              {step === 1 ? 'Create New Folder' : 'Set Permissions'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-140px)] overflow-y-auto">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Folder Name *
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g., Financial Documents"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this folder..."
                  rows="3"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {step === 2 && createdFolderId && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Set Folder Permissions (Optional)</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Control who can access this folder. You can skip this and add permissions later.
                    </p>
                  </div>
                </div>
              </div>

              <PermissionManager
                resourceType="folder"
                resourceId={createdFolderId}
                roomId={roomId}
                onClose={() => {}}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>

          {step === 1 ? (
            <button
              onClick={handleCreateFolder}
              disabled={creating}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create & Continue</span>
              )}
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
