'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Upload, File, AlertCircle, CheckCircle2,
  ChevronDown, Paperclip, Trash2, Image, FileText, FileArchive,
  FileCode, Film, Music, Shield, Server, HardDrive, Loader2,
  Lock, Eye, EyeOff, Cloud
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_PROVIDERS = [
  { id: 'server',       name: 'Server Storage', icon: Server,    description: 'Store on application server'   },
  { id: 'google-drive', name: 'Google Drive',   icon: Cloud,     description: 'Store on Google Drive'         },
  { id: 'onedrive',     name: 'OneDrive',       icon: HardDrive, description: 'Store on Microsoft OneDrive'   },
  { id: 'mega',         name: 'Mega',           icon: HardDrive, description: 'Store on Mega cloud'           },
  { id: 'mediafire',    name: 'MediaFire',      icon: HardDrive, description: 'Store on MediaFire'            },
];

const MAX_FILE_SIZE_MB = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (typeof bytes === 'string') {
    const num = parseFloat(bytes);
    if (!isNaN(num)) bytes = num;
    else return bytes.match(/^\d/) ? bytes : '—';
  }
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function getFileIcon(name = '') {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext))
    return <Image className="w-4 h-4 text-pink-500" />;
  if (['mp4','mov','avi','webm'].includes(ext))
    return <Film className="w-4 h-4 text-purple-500" />;
  if (['mp3','wav','flac','ogg'].includes(ext))
    return <Music className="w-4 h-4 text-indigo-500" />;
  if (['zip','rar','tar','gz'].includes(ext))
    return <FileArchive className="w-4 h-4 text-amber-500" />;
  if (['js','ts','py','java','go','rs','html','css','json'].includes(ext))
    return <FileCode className="w-4 h-4 text-emerald-500" />;
  if (['pdf','doc','docx','txt','md'].includes(ext))
    return <FileText className="w-4 h-4 text-blue-500" />;
  return <File className="w-4 h-4 text-gray-400" />;
}

// ─── Password Modal ──────────────────────────────────────────────────────────

function PasswordModal({ isOpen, onClose, onConfirm, fileName }) {
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [validationError, setValidationError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setValidationError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!password)                       return setValidationError('Password is required.');
    if (password.length < 4)             return setValidationError('Password must be at least 4 characters.');
    if (password !== confirmPassword)    return setValidationError('Passwords do not match.');
    onConfirm(password);
    onClose();
  };

  // Password strength (0-4)
  const strength = Math.min(4, Math.floor(password.length / 3));
  const strengthColor = ['bg-gray-100', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-400'][strength];
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 animate-modal-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <Lock className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Password Protect</h3>
              <p className="text-xs text-gray-400 truncate max-w-[180px]">{fileName}</p>
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
        <div className="px-5 py-4 space-y-3">
          {validationError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {validationError}
            </div>
          )}

          {/* Password field */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setValidationError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onClose(); }}
                placeholder="Enter password"
                className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm field */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setValidationError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onClose(); }}
              placeholder="Re-enter password"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none transition-all"
            />
          </div>

          {/* Strength bar */}
          {password && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1,2,3,4].map(i => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= strength ? strengthColor : 'bg-gray-100'}`}
                  />
                ))}
              </div>
              {strengthLabel && (
                <p className="text-[11px] text-gray-400">{strengthLabel} password</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleConfirm}
            disabled={!password || !confirmPassword}
            className="px-4 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            Set Password
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FileRow ─────────────────────────────────────────────────────────────────

function FileRow({ file, onRemove, onTogglePassword, uploadState, scanState, hasPassword, uploading }) {
  const isUploading = uploadState === 'uploading';
  const isDone      = uploadState === 'done';
  const isError     = uploadState === 'error';
  const isScanning  = scanState  === 'scanning';
  const isSafe      = scanState  === 'safe';
  const isThreat    = scanState  === 'threat';

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
      isDone             ? 'border-emerald-200 bg-emerald-50/60' :
      isError || isThreat ? 'border-red-200 bg-red-50/60'       :
                            'border-gray-100 bg-gray-50/80'
    }`}>
      <div className="shrink-0">{getFileIcon(file.name)}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium text-gray-800 truncate max-w-[160px]">{file.name}</p>

          {isScanning && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Scanning
            </span>
          )}
          {isSafe && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
              <Shield className="w-2.5 h-2.5" /> Safe
            </span>
          )}
          {isThreat && (
            <span className="flex items-center gap-1 text-[11px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
              <AlertCircle className="w-2.5 h-2.5" /> Threat
            </span>
          )}
          {hasPassword && (
            <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
              <Lock className="w-2.5 h-2.5" /> Protected
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{formatBytes(file.size)}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {isUploading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        {isDone      && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        {isError     && <AlertCircle  className="w-4 h-4 text-red-500"     />}

        {/* Password toggle */}
        {!isUploading && !isDone && !isThreat && (
          <button
            onClick={() => onTogglePassword(file)}
            title={hasPassword ? 'Remove password' : 'Add password protection'}
            className={`p-1.5 rounded-lg transition-colors ${
              hasPassword
                ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Remove file */}
        {!isUploading && !isDone && (
          <button
            onClick={() => onRemove(file)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main UploadModal ─────────────────────────────────────────────────────────

export default function UploadModal({
  isOpen,
  onClose,
  onUpload,
  defaultProjectId = null,
  defaultFolderId  = null,
  userProjects     = [],
}) {
  const dropRef  = useRef(null);
  const inputRef = useRef(null);
  const storageDropdownRef = useRef(null);

  // ── State ─────────────────────────────────────────────────────────────────

  const [selectedFiles,  setSelectedFiles]  = useState([]);
  const [projectId,      setProjectId]      = useState(defaultProjectId || '');
  const [folderId,       setFolderId]       = useState(defaultFolderId  || '');
  const [folders,        setFolders]        = useState([]);
  const [uploading,      setUploading]      = useState(false);
  const [uploadStates,   setUploadStates]   = useState({});
  const [scanStates,     setScanStates]     = useState({});
  const [filePasswords,  setFilePasswords]  = useState({});   // ← properly declared
  const [error,          setError]          = useState('');
  const [isDragOver,     setIsDragOver]     = useState(false);
  const [done,           setDone]           = useState(false);

  const [storageProvider,     setStorageProvider]     = useState('server');
  const [showStorageDropdown, setShowStorageDropdown] = useState(false);
  const [externalUrl,         setExternalUrl]         = useState('');

  const [passwordModal, setPasswordModal] = useState({ isOpen: false, file: null });

  const [serverSettings, setServerSettings] = useState({
    allowInternUpload: false, allowedFileTypes: [], maxFileSize: MAX_FILE_SIZE_MB,
  });
  const [userRole, setUserRole] = useState(null);

  // ── Sync prop defaults ────────────────────────────────────────────────────

  useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId);
    if (defaultFolderId)  setFolderId(defaultFolderId);
  }, [defaultProjectId, defaultFolderId]);

  // ── Reset on open ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setSelectedFiles([]);
      setUploadStates({});
      setScanStates({});
      setFilePasswords({});                         // ← correctly clears on open
      setError('');
      setDone(false);
      setShowStorageDropdown(false);
      setPasswordModal({ isOpen: false, file: null });
      fetchUserAndSettings();
    }
  }, [isOpen]);

  // ── Storage dropdown outside-click ───────────────────────────────────────

  useEffect(() => {
    if (!showStorageDropdown) return;
    const handler = e => {
      if (storageDropdownRef.current && !storageDropdownRef.current.contains(e.target)) {
        setShowStorageDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStorageDropdown]);

  // ── Fetch folders ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (projectId) fetchFolders(projectId);
    else setFolders([]);
  }, [projectId]);

  // ── Drag prevention on drop zone ─────────────────────────────────────────

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const prevent = e => e.preventDefault();
    el.addEventListener('dragover', prevent);
    el.addEventListener('drop',     prevent);
    return () => {
      el.removeEventListener('dragover', prevent);
      el.removeEventListener('drop',     prevent);
    };
  }, []);

  // ── API ───────────────────────────────────────────────────────────────────

  const fetchUserAndSettings = async () => {
    try {
      const [userRes, settingsRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/server-settings'),
      ]);
      if (userRes.ok) {
        const u = await userRes.json();
        setUserRole(u.user?.role);
      }
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setServerSettings(s.data || s);
      }
    } catch { /* silent */ }
  };

  const fetchFolders = async (pid) => {
    try {
      const res = await fetch(`/api/documentation/folders?projectId=${pid}`);
      if (!res.ok) return;
      const all = await res.json();

      const buildPath = (folder) => {
        if (!folder.parentId) return folder.name;
        const pidStr = typeof folder.parentId === 'object' ? folder.parentId.toString() : folder.parentId;
        const parent = all.find(f => {
          const fid = typeof f._id === 'object' ? f._id.toString() : f._id;
          return fid === pidStr;
        });
        return parent ? `${buildPath(parent)} / ${folder.name}` : folder.name;
      };

      setFolders(all.map(f => ({ ...f, displayPath: buildPath(f) })));
    } catch { /* silent */ }
  };

  const scanFile = async (file) => {
    try {
      setScanStates(prev => ({ ...prev, [file.name]: 'scanning' }));
      const fd = new FormData();
      fd.append('file', file);
      const res    = await fetch('/api/documentation/scan', { method: 'POST', body: fd });
      const result = await res.json();
      if (result.safe) {
        setScanStates(prev => ({ ...prev, [file.name]: 'safe' }));
        return true;
      } else {
        setScanStates(prev => ({ ...prev, [file.name]: 'threat' }));
        setError(`Threat detected in "${file.name}": ${result.threats?.join(', ')}`);
        return false;
      }
    } catch {
      // Fail open — scanner unavailable
      setScanStates(prev => ({ ...prev, [file.name]: 'safe' }));
      return true;
    }
  };

  // ── File management ───────────────────────────────────────────────────────

  const addFiles = useCallback((incoming) => {
    const maxBytes = (serverSettings.maxFileSize || MAX_FILE_SIZE_MB) * 1024 * 1024;

    for (const f of incoming) {
      if (selectedFiles.some(s => s.name === f.name && s.size === f.size)) continue;

      if (f.size > maxBytes) {
        setError(`"${f.name}" exceeds the ${serverSettings.maxFileSize || MAX_FILE_SIZE_MB} MB limit.`);
        continue;
      }

      if (userRole === 'Intern' && serverSettings.allowedFileTypes?.length > 0) {
        const ext = '.' + f.name.split('.').pop().toLowerCase();
        if (!serverSettings.allowedFileTypes.includes(ext)) {
          setError(`File type "${ext}" is not allowed. Allowed: ${serverSettings.allowedFileTypes.join(', ')}`);
          continue;
        }
      }

      setSelectedFiles(prev => [...prev, f]);
      setScanStates(prev => ({ ...prev, [f.name]: 'pending' }));
    }
  }, [selectedFiles, serverSettings, userRole]);

  const removeFile = (file) => {
    setSelectedFiles(prev  => prev.filter(f => f !== file));
    setFilePasswords(prev  => { const n = { ...prev }; delete n[file.name]; return n; });
    setScanStates(prev     => { const n = { ...prev }; delete n[file.name]; return n; });
    setUploadStates(prev   => { const n = { ...prev }; delete n[file.name]; return n; });
  };

  const handleTogglePassword = (file) => {
    if (filePasswords[file.name]) {
      // Remove password
      setFilePasswords(prev => { const n = { ...prev }; delete n[file.name]; return n; });
    } else {
      setPasswordModal({ isOpen: true, file });
    }
  };

  const handlePasswordConfirm = (password) => {
    if (passwordModal.file) {
      setFilePasswords(prev => ({ ...prev, [passwordModal.file.name]: password }));
    }
    setPasswordModal({ isOpen: false, file: null });
  };

  // ── Drop / input ──────────────────────────────────────────────────────────

  const handleDrop = (e) => {
    setIsDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileInput = (e) => {
    addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  // ── Upload ────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!selectedFiles.length) return setError('Please select at least one file.');
    if (!projectId)            return setError('Please select a project space.');
    if (userRole === 'Intern' && !serverSettings.allowInternUpload) {
      return setError('Your role does not have upload permission.');
    }

    // Validate external URL for non-server providers
    const isExternalProvider = storageProvider !== 'server';
    if (isExternalProvider && !externalUrl.trim()) {
      return setError(`Please provide the ${storageProvider} link for the uploaded file(s).`);
    }

    setUploading(true);
    setError('');

    const states = {};
    selectedFiles.forEach(f => { states[f.name] = 'uploading'; });
    setUploadStates(states);

    try {
      // Scan all files
      const safeFiles = [];
      for (const file of selectedFiles) {
        const safe = await scanFile(file);
        if (safe)  safeFiles.push(file);
        else       setUploadStates(prev => ({ ...prev, [file.name]: 'error' }));
      }

      if (!safeFiles.length) { setUploading(false); return; }

      const formData = new FormData();
      safeFiles.forEach(f => {
        formData.append('files', f);
        if (filePasswords[f.name]) formData.append(`password_${f.name}`, filePasswords[f.name]);
      });
      formData.append('projectId', projectId);
      if (folderId) formData.append('folderId', folderId);
      formData.append('storageProvider', storageProvider);
      if (isExternalProvider) {
        formData.append('externalUrl', externalUrl.trim());
      }

      const res = await fetch('/api/documentation/upload', { method: 'POST', body: formData });

      if (res.ok) {
        const updated = {};
        safeFiles.forEach(f => { updated[f.name] = 'done'; });
        setUploadStates(updated);
        setDone(true);
        setTimeout(() => { onUpload(); resetAndClose(); }, 1200);
      } else {
        const data = await res.json();
        const updated = {};
        safeFiles.forEach(f => { updated[f.name] = 'error'; });
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

  // ── Reset + close — THE actual fix ───────────────────────────────────────

  const resetAndClose = () => {
    setSelectedFiles([]);
    setProjectId(defaultProjectId || '');
    setFolderId(defaultFolderId   || '');
    setUploadStates({});
    setScanStates({});
    setFilePasswords({});
    setExternalUrl('');
    setError('');
    setDone(false);
    setShowStorageDropdown(false);
    setPasswordModal({ isOpen: false, file: null });
    onClose();
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalSize       = selectedFiles.reduce((s, f) => s + f.size, 0);
  const hasThreat       = Object.values(scanStates).some(s => s === 'threat');
  const passwordedCount = Object.keys(filePasswords).length;
  const selectedProvider = STORAGE_PROVIDERS.find(p => p.id === storageProvider);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes modal-in {
          from { opacity:0; transform: translateY(12px) scale(0.98); }
          to   { opacity:1; transform: translateY(0) scale(1); }
        }
        .animate-modal-in { animation: modal-in 0.22s cubic-bezier(0.16,1,0.3,1); }
        @keyframes slide-down {
          from { opacity:0; transform: translateY(-6px); }
          to   { opacity:1; transform: translateY(0); }
        }
        .animate-slide-down { animation: slide-down 0.15s ease-out; }
      `}</style>

      {/* Backdrop — clicking it calls resetAndClose correctly */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) resetAndClose(); }}
      >
        <div className="animate-modal-in bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-gray-100 max-h-[92vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Upload className="w-[18px] h-[18px] text-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 leading-tight">Upload Files</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Any file type · up to {serverSettings.maxFileSize || MAX_FILE_SIZE_MB} MB each
                </p>
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

            {/* Project + Folder */}
            <div className="grid grid-cols-2 gap-3">
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
                    {userProjects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>

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
                    {folders.map(f => <option key={f._id} value={f._id}>{f.displayPath || f.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Storage provider */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Storage Provider
              </label>
              <div className="relative" ref={storageDropdownRef}>
                <button
                  onClick={() => setShowStorageDropdown(v => !v)}
                  disabled={uploading}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  <div className="flex items-center gap-2.5">
                    {selectedProvider && <selectedProvider.icon className="w-4 h-4 text-gray-500 shrink-0" />}
                    <span className="font-medium text-gray-800">{selectedProvider?.name}</span>
                    <span className="text-xs text-gray-400 hidden sm:inline">{selectedProvider?.description}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showStorageDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showStorageDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 animate-slide-down">
                    {STORAGE_PROVIDERS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setStorageProvider(p.id); setShowStorageDropdown(false); }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm transition-colors ${
                          storageProvider === p.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <p.icon className={`w-4 h-4 shrink-0 ${storageProvider === p.id ? 'text-blue-500' : 'text-gray-400'}`} />
                        <div className="text-left flex-1">
                          <p className={`font-medium leading-tight ${storageProvider === p.id ? 'text-blue-700' : 'text-gray-800'}`}>{p.name}</p>
                          <p className="text-xs text-gray-400">{p.description}</p>
                        </div>
                        {storageProvider === p.id && <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {storageProvider !== 'server' && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Cloud className="w-3.5 h-3.5 text-amber-500" />
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      External Storage URL
                    </label>
                  </div>
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder={`Enter the ${storageProvider} shareable link for your file(s)`}
                    className="w-full px-3 py-2.5 text-sm border border-amber-200 rounded-xl bg-amber-50/50 focus:bg-white focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none transition-all"
                  />
                  <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    First upload your file(s) to {selectedProvider?.name}, then paste the shareable link here
                  </p>
                </div>
              )}
            </div>

            {/* Drop zone */}
            <div
              ref={dropRef}
              onDragEnter={() => setIsDragOver(true)}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && inputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-3 py-7 rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none ${
                isDragOver
                  ? 'border-blue-400 bg-blue-50/70 scale-[1.01]'
                  : 'border-gray-200 bg-gray-50/60 hover:border-blue-300 hover:bg-blue-50/30'
              } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isDragOver ? 'bg-blue-100' : 'bg-white border border-gray-200'}`}>
                {isDragOver
                  ? <Paperclip className="w-5 h-5 text-blue-500" />
                  : <Upload    className="w-5 h-5 text-gray-400" />
                }
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  {isDragOver ? 'Drop files here' : 'Drop files or click to browse'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  All file types · Max {serverSettings.maxFileSize || MAX_FILE_SIZE_MB} MB per file
                </p>
              </div>
              <input ref={inputRef} type="file" multiple onChange={handleFileInput} className="sr-only" />
            </div>

            {/* File list */}
            {selectedFiles.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} · {formatBytes(totalSize)}
                    </p>
                    {passwordedCount > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        <Lock className="w-2.5 h-2.5" /> {passwordedCount} protected
                      </span>
                    )}
                  </div>
                  {!uploading && (
                    <button
                      onClick={() => { setSelectedFiles([]); setScanStates({}); setFilePasswords({}); setUploadStates({}); }}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {selectedFiles.map((file, i) => (
                    <FileRow
                      key={`${file.name}-${i}`}
                      file={file}
                      onRemove={removeFile}
                      onTogglePassword={handleTogglePassword}
                      uploadState={uploadStates[file.name]}
                      scanState={scanStates[file.name]}
                      hasPassword={!!filePasswords[file.name]}
                      uploading={uploading}
                    />
                  ))}
                </div>

                {!uploading && passwordedCount === 0 && (
                  <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                    <Lock className="w-3 h-3 shrink-0" />
                    Tap the lock icon on any file to add password protection before uploading.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/70 shrink-0">
            <button
              onClick={resetAndClose}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleUpload}
              disabled={uploading || !projectId || !selectedFiles.length || done || hasThreat}
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
                <>
                  <Upload className="w-4 h-4" />
                  Upload{selectedFiles.length > 0 ? ` ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}` : ''}
                  {passwordedCount > 0 && <Lock className="w-3.5 h-3.5 opacity-70" />}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Password modal — rendered outside the main modal so z-index stacks correctly */}
      <PasswordModal
        isOpen={passwordModal.isOpen}
        onClose={() => setPasswordModal({ isOpen: false, file: null })}
        onConfirm={handlePasswordConfirm}
        fileName={passwordModal.file?.name || ''}
      />
    </>
  );
}