'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  File, Folder, Download, MoreVertical, Edit2, Trash2,
  Copy, Move, Lock, Unlock, History, Grid, List,
  FileText, FileImage, FileVideo, FileArchive, FileCode,
  ChevronRight, Share2, Music, Home, X, BookOpen
} from 'lucide-react';

// ─── File type → icon map ────────────────────────────────────────────────────

const EXT_MAP = {
  pdf:  FileText,  doc:  FileText,  docx: FileText,  txt: FileText,  md: BookOpen,
  jpg:  FileImage, jpeg: FileImage, png:  FileImage,  gif: FileImage, svg: FileImage, webp: FileImage,
  mp4:  FileVideo, mov:  FileVideo, avi:  FileVideo,  webm: FileVideo,
  mp3:  Music,     wav:  Music,     flac: Music,      ogg: Music,
  zip:  FileArchive, rar: FileArchive, '7z': FileArchive, tar: FileArchive, gz: FileArchive,
  js:   FileCode,  jsx: FileCode,   ts:   FileCode,   tsx: FileCode,
  py:   FileCode,  json: FileCode,  html: FileCode,   css: FileCode,  go: FileCode, rs: FileCode,
};

const EXT_COLORS = {
  pdf:  'text-red-500',   doc:  'text-blue-600',  docx: 'text-blue-600',  txt: 'text-gray-500', md: 'text-emerald-600',
  jpg:  'text-pink-500',  jpeg: 'text-pink-500',  png:  'text-pink-500',  gif: 'text-purple-500', svg: 'text-orange-500', webp: 'text-pink-400',
  mp4:  'text-violet-500', mov: 'text-violet-500', avi: 'text-violet-500', webm: 'text-violet-500',
  mp3:  'text-indigo-500', wav: 'text-indigo-500', flac: 'text-indigo-500', ogg: 'text-indigo-500',
  zip:  'text-amber-500', rar: 'text-amber-500', '7z': 'text-amber-500', tar: 'text-amber-500', gz: 'text-amber-500',
  js:   'text-yellow-500', jsx: 'text-cyan-500',  ts:   'text-blue-500',  tsx: 'text-blue-500',
  py:   'text-green-500',  json:'text-orange-400', html:'text-orange-500', css:'text-blue-400',
};

function getFileIcon(fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  return { Icon: EXT_MAP[ext] || File, colorClass: EXT_COLORS[ext] || 'text-gray-400' };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes) {
  if (typeof bytes === 'string') {
    const num = parseFloat(bytes);
    if (!isNaN(num)) bytes = num;
    else return bytes.match(/^\d/) ? bytes : '—';
  }
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)     return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: days > 300 ? 'numeric' : undefined });
}

// ─── Safe action caller ───────────────────────────────────────────────────────

function safe(fn, ...args) {
  return (e) => {
    e?.stopPropagation();
    if (typeof fn === 'function') fn(...args);
  };
}

// ─── Checkbox ────────────────────────────────────────────────────────────────

function Checkbox({ checked, onChange }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(); }}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
        checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white hover:border-blue-400'
      }`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// ─── Dropdown menu (portal-safe, fixed position) ─────────────────────────────

function ContextMenu({ item, isFolder, onClose, triggerRef, onRename, onDuplicate, onMove, onVersionHistory, onToggleLock, onDelete, onOpenExternally, onShare }) {
  const menuRef = useRef(null);

  // Position the menu relative to the trigger button
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 220;
      const menuWidth  = 180;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top  = spaceBelow > menuHeight ? rect.bottom + 4 : rect.top - menuHeight - 4;
      const left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8);
      setPos({ top, left });
    }
  }, [triggerRef]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Build actions based on item type
  const actions = [
    { icon: Edit2,   label: 'Rename',          fn: onRename,         cls: 'text-gray-700' },
    { icon: Copy,    label: 'Duplicate',       fn: onDuplicate,      cls: 'text-gray-700' },
    { icon: Move,    label: 'Move',            fn: onMove,           cls: 'text-gray-700' },
  ];

  // Only show file-specific actions for files
  if (!isFolder) {
    actions.push(
      { icon: History, label: 'Version History', fn: onVersionHistory, cls: 'text-gray-700' },
      { icon: Share2,  label: 'Share',             fn: onShare,          cls: 'text-emerald-600' },
      {
        icon: item.isPasswordProtected ? Unlock : Lock,
        label: item.isPasswordProtected ? 'Remove Password' : 'Add Password',
        fn: onToggleLock,
        cls: 'text-gray-700',
      }
    );

    // Add external viewer option for DOCX and other Office files
    const isOfficeFile = item.fileType === 'docx' ||
                         item.mimeType?.includes('wordprocessingml') ||
                         item.mimeType?.includes('spreadsheetml') ||
                         item.mimeType?.includes('presentationml');

    if (isOfficeFile && typeof onOpenExternally === 'function') {
      actions.push({
        icon: FileText,
        label: 'Open in Office Online',
        fn: onOpenExternally,
        cls: 'text-blue-600'
      });
    }
  }

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, minWidth: 176 }}
      className="bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 animate-menu-in"
      onClick={e => e.stopPropagation()}
    >
      {actions.map(({ icon: Icon, label, fn, cls }) => (
        <button
          key={label}
          onClick={() => { if (typeof fn === 'function') fn(item); onClose(); }}
          className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm ${cls} hover:bg-gray-50 transition-colors`}
        >
          <Icon className="w-3.5 h-3.5 text-gray-400" />
          {label}
        </button>
      ))}
      <div className="border-t border-gray-100 my-1" />
      <button
        onClick={() => { if (typeof onDelete === 'function') onDelete(item); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>
    </div>
  );
}

// ─── Grid Card ────────────────────────────────────────────────────────────────

function GridCard({ item, isFolder, selected, selectionMode, onClick, onDownload, onShare, onRename, onDuplicate, onMove, onVersionHistory, onToggleLock, onDelete, folderPath, onOpenExternally }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered]   = useState(false);
  const moreRef = useRef(null);

  const { Icon: FileIcon, colorClass } = isFolder ? { Icon: Folder, colorClass: 'text-amber-400' } : getFileIcon(item.name);

  return (
    <div
      className={`relative group bg-white rounded-2xl border transition-all cursor-pointer select-none ${
        selected
          ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
      } ${item.isDisabled ? 'opacity-50' : ''}`}
      onClick={() => onClick(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <div className="absolute top-2.5 left-2.5 z-10">
          <Checkbox checked={selected} onChange={() => onClick(item)} />
        </div>
      )}

      {/* More menu button - always visible, positioned below version badge */}
      {!selectionMode && (
        <div className="absolute top-2 right-2.5 z-30">
          <button
            ref={moreRef}
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className={`p-1.5 rounded-lg transition-colors ${menuOpen ? 'bg-gray-100 text-gray-700' : 'bg-white/90 hover:bg-gray-100 text-gray-500'}`}
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Status badges */}
      <div className="absolute top-2 right-8 flex items-center gap-1 z-20 pointer-events-none">
        {item.isPasswordProtected && (
          <span className="flex items-center justify-center w-5 h-5 bg-amber-50 border border-amber-200 rounded-md">
            <Lock className="w-2.5 h-2.5 text-amber-600" />
          </span>
        )}
        {item.currentVersion > 1 && (
          <span className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-600 text-[10px] font-bold rounded-md pointer-events-auto">
            v{item.currentVersion}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-col items-center text-center p-4 pt-5 pb-3">
        <div className={`w-12 h-12 flex items-center justify-center rounded-xl mb-3 ${
          isFolder ? 'bg-amber-50' : 'bg-gray-50'
        }`}>
          <FileIcon className={`w-7 h-7 ${colorClass}`} />
        </div>
        <span className="text-sm font-medium text-gray-900 truncate w-full leading-tight" title={item.name}>
          {item.name}
        </span>
        {!isFolder && (
          <span className="text-xs text-gray-400 mt-0.5">{formatFileSize(item.fileSize)}</span>
        )}
        {!isFolder && folderPath && (
          <span className="text-[10px] text-gray-400 mt-0.5 truncate w-full flex items-center justify-center gap-1" title={folderPath}>
            <Folder className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{folderPath}</span>
          </span>
        )}
      </div>

      {menuOpen && (
        <ContextMenu
          item={item}
          isFolder={isFolder}
          onClose={() => setMenuOpen(false)}
          triggerRef={moreRef}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onMove={onMove}
          onVersionHistory={onVersionHistory}
          onToggleLock={onToggleLock}
          onDelete={onDelete}
          onOpenExternally={onOpenExternally}
          onShare={onShare}
        />
      )}
    </div>
  );
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function ListRow({ item, isFolder, selected, selectionMode, onClick, onDownload, onShare, onRename, onDuplicate, onMove, onVersionHistory, onToggleLock, onDelete, folderPath, onOpenExternally }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef(null);
  const { Icon: FileIcon, colorClass } = isFolder ? { Icon: Folder, colorClass: 'text-amber-400' } : getFileIcon(item.name);

  return (
    <tr
      className={`group cursor-pointer transition-colors ${
        selected ? 'bg-blue-50' : 'hover:bg-gray-50/80'
      } ${item.isDisabled ? 'opacity-50' : ''}`}
      onClick={() => onClick(item)}
    >
      {selectionMode && (
        <td className="pl-4 py-3 w-10">
          <Checkbox checked={selected} onChange={() => onClick(item)} />
        </td>
      )}

      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isFolder ? 'bg-amber-50' : 'bg-gray-50'}`}>
            <FileIcon className={`w-4 h-4 ${colorClass}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
              {item.isPasswordProtected && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
              {!isFolder && item.currentVersion > 1 && (
                <span className="px-1 py-px bg-blue-50 text-blue-600 text-[10px] font-bold rounded">
                  v{item.currentVersion}
                </span>
              )}
            </div>
            {!isFolder && folderPath && (
              <div className="flex items-center gap-1 mt-0.5">
                <Folder className="w-2.5 h-2.5 text-gray-300 shrink-0" />
                <span className="text-[11px] text-gray-400 truncate">{folderPath}</span>
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Size */}
      <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell tabular-nums whitespace-nowrap">
        {isFolder ? '—' : formatFileSize(item.fileSize)}
      </td>

      {/* Modified */}
      <td className="px-4 py-3 text-sm text-gray-400 hidden lg:table-cell whitespace-nowrap">
        {formatDate(item.updatedAt || item.createdAt)}
      </td>

      {/* Version */}
      <td className="px-4 py-3 text-sm text-gray-400 hidden lg:table-cell">
        {isFolder ? '—' : `v${item.currentVersion || 1}`}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 w-28" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-0.5 justify-end">
          {!isFolder && typeof onShare === 'function' && (
            <button onClick={safe(onShare, item)} title="Share" className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors">
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
          {!isFolder && (
            <button onClick={safe(onDownload, item)} title="Download" className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            ref={moreRef}
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className={`p-1.5 rounded-lg text-gray-400 transition-colors ${menuOpen ? 'bg-gray-100 text-gray-700' : 'hover:bg-gray-100 hover:text-gray-700'}`}
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <ContextMenu
              item={item}
              isFolder={isFolder}
              onClose={() => setMenuOpen(false)}
              triggerRef={moreRef}
              onRename={onRename}
              onDuplicate={onDuplicate}
              onMove={onMove}
              onVersionHistory={onVersionHistory}
              onToggleLock={onToggleLock}
              onDelete={onDelete}
              onOpenExternally={onOpenExternally}
              onShare={onShare}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main FileList ────────────────────────────────────────────────────────────

export default function FileList({
  items = [],
  folders = [],
  viewMode = 'grid',
  onFolderClick,
  onFileClick,
  onDownload,
  onDelete,
  onRename,
  onRenameFolder,
  onDuplicate,
  onMove,
  onVersionHistory,
  onToggleLock,
  onShare,
  onOpenExternally,
  selectionMode = false,
  selectedItems = [],
  onToggleSelection,
  breadcrumbs = [],
  onBreadcrumbClick,
}) {
  const [folderPaths, setFolderPaths] = useState({});
  const [renameModal, setRenameModal] = useState({ show: false, item: null, name: '', isFolder: false });

  // Handle rename with modal
  const handleRenameClick = useCallback((item, isFolder = false) => {
    setRenameModal({ show: true, item, name: item.name, isFolder });
  }, []);

  const handleRenameSubmit = async () => {
    if (!renameModal.item || !renameModal.name.trim()) return;
    const callback = renameModal.isFolder && onRenameFolder ? onRenameFolder : onRename;
    await callback(renameModal.item, renameModal.name.trim());
    setRenameModal({ show: false, item: null, name: '', isFolder: false });
  };

  // Fetch folder paths in parallel (fixed: was sequential)
  useEffect(() => {
    const uniqueIds = [...new Set(items.filter(f => f.folderId).map(f => f.folderId))];
    if (!uniqueIds.length) return;

    Promise.all(
      uniqueIds.map(id =>
        fetch(`/api/documentation/folders/${id}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => data ? [id, data.path || `/${data.name}`] : null)
          .catch(() => null)
      )
    ).then(results => {
      const paths = {};
      results.forEach(r => { if (r) paths[r[0]] = r[1]; });
      setFolderPaths(paths);
    });
  }, [items]);

  // Shared click handler: selection mode vs navigation
  const handleItemClick = useCallback((item, isFolder) => {
    if (selectionMode) {
      if (typeof onToggleSelection === 'function') onToggleSelection(item._id);
    } else {
      if (isFolder && typeof onFolderClick === 'function') onFolderClick(item);
      else if (!isFolder && typeof onFileClick === 'function') onFileClick(item);
    }
  }, [selectionMode, onToggleSelection, onFolderClick, onFileClick]);

  // Wrapper for onDelete that passes isFolder flag
  const handleDelete = useCallback((item, isFolder) => {
    if (typeof onDelete === 'function') {
      onDelete(item, isFolder);
    }
  }, [onDelete]);

  const isEmpty = folders.length === 0 && items.length === 0;

  // ── Breadcrumbs ──────────────────────────────────────────────────────────────

  const renderBreadcrumbs = () => (
    <nav className="flex items-center gap-1 text-sm mb-5 flex-wrap">
      <button
        onClick={() => typeof onBreadcrumbClick === 'function' && onBreadcrumbClick(null, 'Home', -1)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors font-medium"
      >
        <Home className="w-3.5 h-3.5" />
        <span>Home</span>
      </button>
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        return (
          <React.Fragment key={crumb.id || index}>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <button
              onClick={() => !isLast && typeof onBreadcrumbClick === 'function' && onBreadcrumbClick(crumb.id, crumb.name, index)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
                isLast
                  ? 'text-gray-900 bg-gray-100 cursor-default'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {crumb.name}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );

  // ── Empty state ──────────────────────────────────────────────────────────────

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
        <Folder className="w-7 h-7 text-gray-300" />
      </div>
      <h3 className="text-sm font-semibold text-gray-700">This folder is empty</h3>
      <p className="text-xs text-gray-400 mt-1.5 max-w-xs">Upload files or create a new folder to get started.</p>
    </div>
  );

  // ── Grid view ────────────────────────────────────────────────────────────────

  const renderGrid = () => {
    if (isEmpty) return renderEmpty();
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {folders.map(folder => (
          <GridCard
            key={folder._id}
            item={folder}
            isFolder
            selected={selectedItems.includes(folder._id)}
            selectionMode={selectionMode}
            onClick={() => handleItemClick(folder, true)}
            onDownload={onDownload}
            onShare={onShare}
            onRename={() => handleRenameClick(folder, true)}
            onDuplicate={onDuplicate}
            onMove={onMove}
            onVersionHistory={onVersionHistory}
            onToggleLock={onToggleLock}
            onDelete={(item) => handleDelete(item, true)}
            onOpenExternally={onOpenExternally}
          />
        ))}
        {items.map(item => (
          <GridCard
            key={item._id}
            item={item}
            isFolder={false}
            selected={selectedItems.includes(item._id)}
            selectionMode={selectionMode}
            onClick={() => handleItemClick(item, false)}
            onDownload={onDownload}
            onShare={onShare}
            onRename={() => handleRenameClick(item, false)}
            onDuplicate={onDuplicate}
            onMove={onMove}
            onVersionHistory={onVersionHistory}
            onToggleLock={onToggleLock}
            onDelete={(item) => handleDelete(item, false)}
            folderPath={item.folderId ? folderPaths[item.folderId] : null}
            onOpenExternally={onOpenExternally}
          />
        ))}
      </div>
    );
  };

  // ── List view ────────────────────────────────────────────────────────────────

  const renderList = () => (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            {selectionMode && <th className="w-10 pl-4 py-3" />}
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Size</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Modified</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Version</th>
            <th className="w-28 px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {folders.map(folder => (
            <ListRow
              key={folder._id}
              item={folder}
              isFolder
              selected={selectedItems.includes(folder._id)}
              selectionMode={selectionMode}
              onClick={() => handleItemClick(folder, true)}
              onDownload={onDownload}
              onShare={onShare}
              onRename={() => handleRenameClick(folder, true)}
              onDuplicate={onDuplicate}
              onMove={onMove}
              onVersionHistory={onVersionHistory}
              onToggleLock={onToggleLock}
              onDelete={(item) => handleDelete(item, true)}
              onOpenExternally={onOpenExternally}
            />
          ))}
          {items.map(item => (
            <ListRow
              key={item._id}
              item={item}
              isFolder={false}
              selected={selectedItems.includes(item._id)}
              selectionMode={selectionMode}
              onClick={() => handleItemClick(item, false)}
              onDownload={onDownload}
              onShare={onShare}
              onRename={() => handleRenameClick(item, false)}
              onDuplicate={onDuplicate}
              onMove={onMove}
              onVersionHistory={onVersionHistory}
              onToggleLock={onToggleLock}
              onDelete={(item) => handleDelete(item, false)}
              folderPath={item.folderId ? folderPaths[item.folderId] : null}
              onOpenExternally={onOpenExternally}
            />
          ))}
        </tbody>
      </table>
      {isEmpty && renderEmpty()}
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes menu-in {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-menu-in { animation: menu-in 0.13s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>

      <div>
        {renderBreadcrumbs()}
        {viewMode === 'grid' ? renderGrid() : renderList()}
      </div>

      {/* Rename Modal */}
      {renameModal.show && renameModal.item && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRenameModal({ show: false, item: null, name: '', isFolder: false })}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{renameModal.isFolder ? 'Rename Folder' : 'Rename File'}</h2>
              <button onClick={() => setRenameModal({ show: false, item: null, name: '', isFolder: false })} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Name
              </label>
              <input
                type="text"
                value={renameModal.name}
                onChange={(e) => setRenameModal(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') setRenameModal({ show: false, item: null, name: '' });
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Current: {renameModal.item.name}
              </p>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setRenameModal({ show: false, item: null, name: '' })}
                className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={!renameModal.name.trim() || renameModal.name === renameModal.item.name}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}