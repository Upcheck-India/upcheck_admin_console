'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Upload, File, AlertCircle, CheckCircle2, FolderOpen,
  ChevronDown, Paperclip, Trash2, Image, FileText, FileArchive,
  FileCode, Film, Music
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name = '') {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
    return <Image className="w-4 h-4 text-pink-500" />;
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext))
    return <Film className="w-4 h-4 text-purple-500" />;
  if (['mp3', 'wav', 'flac', 'ogg'].includes(ext))
    return <Music className="w-4 h-4 text-indigo-500" />;
  if (['zip', 'rar', 'tar', 'gz'].includes(ext))
    return <FileArchive className="w-4 h-4 text-amber-500" />;
  if (['js', 'ts', 'py', 'java', 'go', 'rs', 'html', 'css', 'json'].includes(ext))
    return <FileCode className="w-4 h-4 text-emerald-500" />;
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext))
    return <FileText className="w-4 h-4 text-blue-500" />;
  return <File className="w-4 h-4 text-gray-400" />;
}

// ─── FileRow ─────────────────────────────────────────────────────────────────

function FileRow({ file, onRemove, uploadState }) {
  const isUploading = uploadState === 'uploading';
  const isDone      = uploadState === 'done';
  const isError     = uploadState === 'error';

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
      isDone  ? 'border-emerald-200 bg-emerald-50/60' :
      isError ? 'border-red-200 bg-red-50/60' :
                'border-gray-100 bg-gray-50/80 hover:bg-gray-100/80'
    }`}>
      <div className="shrink-0">{getFileIcon(file.name)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
        <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
      </div>
      {isUploading && (
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
      )}
      {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
      {isError && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
      {!isUploading && !isDone && (
        <button
          onClick={() => onRemove(file)}
          className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── UploadModal ─────────────────────────────────────────────────────────────

export default function UploadModal({
  isOpen,
  onClose,
  onUpload,
  defaultProjectId = null,
  defaultFolderId  = null,
  userProjects     = [],
}) {
  const dropRef = useRef(null);
  const inputRef = useRef(null);

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [projectId, setProjectId]         = useState(defaultProjectId || '');
  const [folderId,  setFolderId]          = useState(defaultFolderId  || '');
  const [folders,   setFolders]           = useState([]);
  const [uploading, setUploading]         = useState(false);
  const [uploadStates, setUploadStates]   = useState({}); // { fileName: 'uploading'|'done'|'error' }
  const [error,     setError]             = useState('');
  const [isDragOver, setIsDragOver]       = useState(false);
  const [done,      setDone]              = useState(false);

  // Sync defaults
  useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId);
    if (defaultFolderId)  setFolderId(defaultFolderId);
  }, [defaultProjectId, defaultFolderId]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSelectedFiles([]);
      setUploadStates({});
      setError('');
      setDone(false);
    }
  }, [isOpen]);

  // Fetch folders when project changes
  useEffect(() => {
    if (projectId) fetchFolders(projectId);
    else setFolders([]);
  }, [projectId]);

  // Drag events
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const prevent = e => e.preventDefault();
    el.addEventListener('dragover', prevent);
    el.addEventListener('drop', prevent);
    return () => {
      el.removeEventListener('dragover', prevent);
      el.removeEventListener('drop', prevent);
    };
  }, []);

  const fetchFolders = async (pid) => {
    try {
      // Fetch ALL folders for this project to build the tree
      const res = await fetch(`/api/documentation/folders?projectId=${pid}`);
      if (res.ok) {
        const allFolders = await res.json();

        // Build folder path display with hierarchy
        const buildFolderPath = (folder, folders) => {
          if (!folder.parentId) return folder.name;
          const parent = folders.find(f => {
            const fId = typeof f._id === 'object' ? f._id.toString() : f._id;
            const pId = typeof folder.parentId === 'object' ? folder.parentId.toString() : folder.parentId;
            return fId === pId;
          });
          if (parent) {
            return `${buildFolderPath(parent, folders)} / ${folder.name}`;
          }
          return folder.name;
        };

        // Transform folders with path display
        const transformed = allFolders.map(f => ({
          ...f,
          displayPath: buildFolderPath(f, allFolders)
        }));

        setFolders(transformed);
      }
    } catch { /* silent */ }
  };

  const addFiles = useCallback((incoming) => {
    const newFiles = incoming.filter(
      f => !selectedFiles.some(s => s.name === f.name && s.size === f.size)
    );
    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, [selectedFiles]);

  const handleDrop = (e) => {
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFiles(files);
  };

  const handleFileInput = (e) => {
    addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const removeFile = (file) => {
    setSelectedFiles(prev => prev.filter(f => f !== file));
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) return setError('Please select at least one file.');
    if (!projectId)            return setError('Please select a project space.');

    setUploading(true);
    setError('');

    // Mark all as uploading
    const states = {};
    selectedFiles.forEach(f => { states[f.name] = 'uploading'; });
    setUploadStates(states);

    try {
      const formData = new FormData();
      selectedFiles.forEach(f => formData.append('files', f));
      formData.append('projectId', projectId);
      if (folderId) formData.append('folderId', folderId);

      const res = await fetch('/api/documentation/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const updated = {};
        selectedFiles.forEach(f => { updated[f.name] = 'done'; });
        setUploadStates(updated);
        setDone(true);
        setTimeout(() => {
          onUpload();
          resetAndClose();
        }, 1200);
      } else {
        const data = await res.json();
        const updated = {};
        selectedFiles.forEach(f => { updated[f.name] = 'error'; });
        setUploadStates(updated);
        setError(data.error || 'Upload failed. Please try again.');
      }
    } catch {
      const updated = {};
      selectedFiles.forEach(f => { updated[f.name] = 'error'; });
      setUploadStates(updated);
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetAndClose = () => {
    setSelectedFiles([]);
    setProjectId(defaultProjectId || '');
    setFolderId(defaultFolderId || '');
    setUploadStates({});
    setError('');
    setDone(false);
    onClose();
  };

  const totalSize = selectedFiles.reduce((s, f) => s + f.size, 0);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .modal-enter { animation: modal-in 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) resetAndClose(); }}
      >
        <div className="modal-enter bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-gray-100">

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Upload className="w-4.5 h-4.5 text-blue-600 w-[18px] h-[18px]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 leading-tight">Upload Files</h2>
                <p className="text-xs text-gray-400 mt-0.5">Any file type · up to 50 MB each</p>
              </div>
            </div>
            <button
              onClick={resetAndClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Project + Folder row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Project */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Project Space <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select
                    value={projectId}
                    onChange={e => { setProjectId(e.target.value); setFolderId(''); }}
                    disabled={!!defaultProjectId || uploading}
                    className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="">Select space…</option>
                    <option value="general">General</option>
                    {userProjects.map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Folder */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Folder <span className="text-gray-300 font-normal normal-case">optional</span>
                </label>
                <div className="relative">
                  <select
                    value={folderId}
                    onChange={e => setFolderId(e.target.value)}
                    disabled={!projectId || !!defaultFolderId || uploading}
                    className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Root</option>
                    {folders.map(f => (
                      <option key={f._id} value={f._id}>{f.displayPath || f.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Drop zone */}
            <div
              ref={dropRef}
              onDragEnter={() => setIsDragOver(true)}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && inputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-3 py-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none ${
                isDragOver
                  ? 'border-blue-400 bg-blue-50/70 scale-[1.01]'
                  : 'border-gray-200 bg-gray-50/60 hover:border-blue-300 hover:bg-blue-50/30'
              } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${isDragOver ? 'bg-blue-100' : 'bg-white border border-gray-200'}`}>
                {isDragOver
                  ? <Paperclip className="w-5 h-5 text-blue-500" />
                  : <Upload className="w-5 h-5 text-gray-400" />
                }
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  {isDragOver ? 'Drop files here' : 'Drop files or click to browse'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">All file types accepted · Max 50 MB per file</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                onChange={handleFileInput}
                className="sr-only"
              />
            </div>

            {/* File list */}
            {selectedFiles.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} · {formatBytes(totalSize)}
                  </p>
                  {!uploading && (
                    <button
                      onClick={() => setSelectedFiles([])}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {selectedFiles.map((file, i) => (
                    <FileRow
                      key={`${file.name}-${i}`}
                      file={file}
                      onRemove={removeFile}
                      uploadState={uploadStates[file.name]}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/70">
            <button
              onClick={resetAndClose}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleUpload}
              disabled={uploading || !projectId || !selectedFiles.length || done}
              className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all shadow-sm disabled:cursor-not-allowed ${
                done
                  ? 'bg-emerald-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
              }`}
            >
              {done ? (
                <><CheckCircle2 className="w-4 h-4" /> Uploaded!</>
              ) : uploading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="w-4 h-4" /> Upload {selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}` : ''}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}