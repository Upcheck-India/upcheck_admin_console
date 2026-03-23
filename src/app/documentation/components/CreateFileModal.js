'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, FileCode, Folder, ChevronDown, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function CreateFileModal({ isOpen, onClose, onCreate, defaultProjectId = null, defaultFolderId = null, userProjects = [] }) {
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('txt'); // 'txt' or 'docx'
  const [content, setContent] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [folderId, setFolderId] = useState(defaultFolderId || '');
  const [folders, setFolders] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);

  const folderDropdownRef = useRef(null);

  // Sync with props
  useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId);
    if (defaultFolderId) setFolderId(defaultFolderId);
  }, [defaultProjectId, defaultFolderId]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setFileName('');
      setFileType('txt');
      setContent('');
      setProjectId(defaultProjectId || '');
      setFolderId(defaultFolderId || '');
      setError('');
      setCreating(false);
      setShowFolderDropdown(false);
    }
  }, [isOpen, defaultProjectId, defaultFolderId]);

  // Fetch folders when project changes
  useEffect(() => {
    if (projectId) {
      fetchFolders(projectId);
    } else {
      setFolders([]);
    }
  }, [projectId]);

  // Close folder dropdown on outside click
  useEffect(() => {
    if (!showFolderDropdown) return;
    const handler = (e) => {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(e.target)) {
        setShowFolderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFolderDropdown]);

  const fetchFolders = async (pid) => {
    try {
      const res = await fetch(`/api/documentation/folders?projectId=${pid}&all=true`);
      if (!res.ok) return;
      const all = await res.json();

      // Build path for each folder
      const buildPath = (folder) => {
        if (!folder.parentId) return folder.name;
        const parentIdStr = typeof folder.parentId === 'object'
          ? folder.parentId.toString()
          : folder.parentId;
        const parent = all.find(f => {
          const fid = typeof f._id === 'object' ? f._id.toString() : f._id;
          return fid === parentIdStr;
        });
        return parent ? `${buildPath(parent)} / ${folder.name}` : folder.name;
      };

      setFolders(all.map(f => ({ ...f, displayPath: buildPath(f) })));
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  };

  const handleCreate = async () => {
    setError('');

    // Validation
    if (!fileName.trim()) {
      return setError('Please enter a file name.');
    }

    // Validate file name (no special characters)
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(fileName.trim())) {
      return setError('File name cannot contain: < > : " / \\ | ? *');
    }

    if (!projectId) {
      return setError('Please select a project space.');
    }

    if (content === '') {
      return setError('File content cannot be empty.');
    }

    setCreating(true);

    try {
      const response = await fetch('/api/documentation/create-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fileName.trim(),
          type: fileType,
          content: content,
          projectId: projectId,
          folderId: folderId || null
        })
      });

      const result = await response.json();

      if (response.ok) {
        onCreate?.(result.file);
        setCreating(false);
        onClose();
      } else {
        setError(result.error || 'Failed to create file.');
        setCreating(false);
      }
    } catch (err) {
      setError('An error occurred while creating the file.');
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="animate-modal-in bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-gray-100 max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              {fileType === 'txt' ? (
                <FileText className="w-5 h-5 text-blue-600" />
              ) : (
                <FileCode className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">Create New File</h2>
              <p className="text-xs text-gray-400 mt-0.5">Create a text document directly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-sm flex-1">{error}</p>
              <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* File Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              File Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder={`e.g., Meeting Notes${fileType === 'txt' ? '.txt' : '.docx'}`}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all pr-16"
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                .{fileType}
              </span>
            </div>
          </div>

          {/* Project + Folder */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Project Space <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={projectId}
                  onChange={(e) => { setProjectId(e.target.value); setFolderId(''); }}
                  disabled={!!defaultProjectId || creating}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all disabled:bg-gray-50"
                >
                  <option value="">Select space…</option>
                  <option value="general">General</option>
                  {userProjects.map((p) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Folder <span className="text-gray-300 font-normal normal-case">optional</span>
              </label>
              <div className="relative" ref={folderDropdownRef}>
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  disabled={!projectId || creating}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">Root</option>
                  {folders.map((f) => (
                    <option key={f._id} value={f._id}>{f.displayPath || f.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* File Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              File Type <span className="text-gray-300 font-normal normal-case">(select before entering content)</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFileType('txt')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  fileType === 'txt'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Plain Text (.txt)</span>
              </button>
              <button
                type="button"
                onClick={() => setFileType('docx')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  fileType === 'docx'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <FileCode className="w-4 h-4" />
                <span className="text-sm font-medium">Word Document (.docx)</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-[300px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Content <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              {fileType === 'txt' ? (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your text content here..."
                  className="w-full h-[300px] px-3.5 py-3 text-sm font-mono border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all resize-none"
                />
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your document content here. Basic formatting will be preserved when opened in Word..."
                  className="w-full h-[300px] px-3.5 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all resize-none"
                />
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {fileType === 'txt'
                ? 'Plain text format, ideal for code, logs, and simple notes.'
                : 'Word document format, suitable for formatted documents.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/70 shrink-0">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !fileName.trim() || !projectId || content === ''}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all shadow-sm disabled:cursor-not-allowed ${
              creating
                ? 'bg-blue-400'
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
            }`}
          >
            {creating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Create File</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
