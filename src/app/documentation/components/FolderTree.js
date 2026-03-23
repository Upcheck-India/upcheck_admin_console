'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
  FolderPlus, Search, X, MoreHorizontal,
  Edit2, Trash2, Info, Shield, FolderInput, Home
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize any MongoDB ObjectId or string to a plain string. */
function toStr(id) {
  if (id === null || id === undefined) return null;
  return typeof id === 'object' ? id.toString() : String(id);
}

/** Decide if a folder is a root-level folder. */
function isRoot(folder) {
  const pid = toStr(folder.parentId);
  return pid === null || pid === 'null' || pid === '';
}

// ─── Centered modal for folder actions (replaces dropdown) ──────────────────────

function FolderMenu({ folder, onRename, onDelete, onPermissions, onDetails, onCreateSubfolder, onClose }) {
  const handleAction = (fn) => (e) => {
    e.stopPropagation();
    if (typeof fn === 'function') fn(folder);
    onClose();
  };

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
            onClick={handleAction(onCreateSubfolder)}
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
            onClick={handleAction(onRename)}
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
            onClick={handleAction(onDetails)}
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

          <button
            onClick={handleAction(onPermissions)}
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

          <div className="border-t border-gray-100 my-2" />

          <button
            onClick={handleAction(onDelete)}
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

// ─── Single folder node ───────────────────────────────────────────────────────

function FolderNode({
  folder,
  depth,
  isSelected,
  isExpanded,
  hasChildren,
  onSelect,
  onToggle,
  onRename,
  onDelete,
  onPermissions,
  onDetails,
  onCreateSubfolder,
  children,
  matchesSearch,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const folderId = toStr(folder._id);

  // Don't render if there's an active search and this node doesn't match
  if (matchesSearch === false) return null;

  return (
    <li className="relative">
      <div
        className={`group flex items-center gap-1 py-1.5 pr-1 rounded-xl cursor-pointer transition-all select-none ${
          isSelected
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => {
          onSelect(folder._id, folder.name, folder.path);
          if (hasChildren) onToggle(folderId);
        }}
      >
        {/* Expand chevron */}
        <span
          className="w-4 h-4 flex items-center justify-center shrink-0"
          onClick={e => {
            e.stopPropagation();
            if (hasChildren) onToggle(folderId);
          }}
        >
          {hasChildren ? (
            <span className={`transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </span>
          ) : (
            <span className="w-3.5 h-3.5" />
          )}
        </span>

        {/* Folder icon */}
        {isExpanded
          ? <FolderOpen className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-500' : 'text-amber-400'}`} />
          : <Folder     className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-500' : 'text-amber-400'}`} />
        }

        {/* Name */}
        <span className="text-sm truncate flex-1 leading-tight ml-1.5">{folder.name}</span>

        {/* Actions button — only on hover */}
        <div className="relative shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${
              menuOpen
                ? 'opacity-100 bg-gray-200 text-gray-700'
                : 'opacity-0 group-hover:opacity-100 hover:bg-gray-200 text-gray-500'
            }`}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {menuOpen && (
            <FolderMenu
              folder={folder}
              onRename={onRename}
              onDelete={onDelete}
              onPermissions={onPermissions}
              onDetails={onDetails}
              onCreateSubfolder={onCreateSubfolder}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Children — animated slide */}
      {isExpanded && children && (
        <ul className="overflow-hidden animate-expand">
          {children}
        </ul>
      )}
    </li>
  );
}

// ─── Main FolderTree ──────────────────────────────────────────────────────────

export default function FolderTree({
  projectId,
  currentFolderId,
  onFolderSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onFolderPermissions,
  onFolderDetails,
  refreshTrigger,
}) {
  const [folders, setFolders]               = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [loading, setLoading]               = useState(true);
  const [searchQuery, setSearchQuery]       = useState('');
  const [folderCount, setFolderCount]       = useState(0);
  const searchRef = useRef(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchFolders = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/documentation/folders?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data);
        setFolderCount(data.length);
      }
    } catch (err) {
      console.error('FolderTree: fetchFolders error', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchFolders(); }, [fetchFolders, refreshTrigger]);

  // ── Auto-expand parents when currentFolderId changes ────────────────────────
  // Uses the already-fetched `folders` array — no extra API calls

  useEffect(() => {
    if (!currentFolderId || folders.length === 0) return;

    const currentIdStr = toStr(currentFolderId);
    const toExpand = new Set();

    // Walk up the tree using the in-memory folders array
    const findParents = (id) => {
      const folder = folders.find(f => toStr(f._id) === id);
      if (!folder) return;
      const pid = toStr(folder.parentId);
      if (pid && pid !== 'null') {
        toExpand.add(pid);
        findParents(pid);
      }
    };

    findParents(currentIdStr);

    if (toExpand.size > 0) {
      setExpandedFolders(prev => new Set([...prev, ...toExpand]));
    }
  }, [currentFolderId, folders]);

  // ── Keyboard shortcut: Ctrl/Cmd+F to focus search ───────────────────────────

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Tree helpers ─────────────────────────────────────────────────────────────

  const toggleFolder = useCallback((folderId) => {
    const id = toStr(folderId);
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedFolders(new Set(folders.map(f => toStr(f._id))));
  }, [folders]);

  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  // ── Search: collect IDs of folders matching query + all their ancestors ──────

  const matchingIds = useMemo(() => {
    if (!searchQuery.trim()) return null; // null = no filter active
    const q = searchQuery.toLowerCase();
    const directMatches = new Set(
      folders
        .filter(f => f.name.toLowerCase().includes(q))
        .map(f => toStr(f._id))
    );

    // Also expand ancestors of matches so they're visible
    const withAncestors = new Set(directMatches);
    const addAncestors = (id) => {
      const folder = folders.find(f => toStr(f._id) === id);
      if (!folder) return;
      const pid = toStr(folder.parentId);
      if (pid && pid !== 'null' && !withAncestors.has(pid)) {
        withAncestors.add(pid);
        addAncestors(pid);
      }
    };
    directMatches.forEach(addAncestors);

    return withAncestors;
  }, [searchQuery, folders]);

  // Auto-expand matching subtrees when searching
  useEffect(() => {
    if (matchingIds) {
      setExpandedFolders(new Set(matchingIds));
    }
  }, [matchingIds]);

  // ── Recursive tree builder (memoized) ────────────────────────────────────────

  const buildTree = useCallback((parentIdParam = null, depth = 0) => {
    const children = folders.filter(f => {
      const pid = toStr(f.parentId);
      if (parentIdParam === null) {
        return pid === null || pid === 'null' || pid === '';
      }
      return pid === toStr(parentIdParam);
    });

    if (children.length === 0) return null;

    return children.map(folder => {
      const fid = toStr(folder._id);
      const isSelected = toStr(currentFolderId) === fid;
      const isExpanded  = expandedFolders.has(fid);

      // Fix: correctly check for children regardless of current level
      const hasChildren = folders.some(f => toStr(f.parentId) === fid);

      // Search filter: hide nodes not in matchingIds
      if (matchingIds && !matchingIds.has(fid)) return null;

      return (
        <FolderNode
          key={fid}
          folder={folder}
          depth={depth}
          isSelected={isSelected}
          isExpanded={isExpanded}
          hasChildren={hasChildren}
          onSelect={onFolderSelect}
          onToggle={toggleFolder}
          onRename={onRenameFolder}
          onDelete={onDeleteFolder}
          onPermissions={onFolderPermissions}
          onDetails={onFolderDetails}
          onCreateSubfolder={(f) => typeof onCreateFolder === 'function' && onCreateFolder(toStr(f._id))}
          matchesSearch={matchingIds ? matchingIds.has(fid) : null}
        >
          {buildTree(folder._id, depth + 1)}
        </FolderNode>
      );
    });
  }, [
    folders, currentFolderId, expandedFolders, matchingIds,
    onFolderSelect, toggleFolder, onRenameFolder, onDeleteFolder,
    onFolderPermissions, onFolderDetails, onCreateFolder,
  ]);

  const treeNodes = useMemo(() => buildTree(null, 0), [buildTree]);
  const hasAnyFolders = folders.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes menu-in {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-menu-in { animation: menu-in 0.13s cubic-bezier(0.16, 1, 0.3, 1); }

        @keyframes expand {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-expand { animation: expand 0.15s ease-out; }
      `}</style>

      <div className="flex flex-col h-full">

        {/* ── Search bar ── */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search folders…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* ── Expand / Collapse controls ── */}
        {hasAnyFolders && !searchQuery && (
          <div className="flex items-center gap-1 px-3 pb-2">
            <button
              onClick={expandAll}
              className="text-[10px] text-gray-400 hover:text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors font-medium"
            >
              Expand all
            </button>
            <span className="text-gray-200">·</span>
            <button
              onClick={collapseAll}
              className="text-[10px] text-gray-400 hover:text-gray-700 hover:bg-gray-100 px-2 py-0.5 rounded-md transition-colors font-medium"
            >
              Collapse all
            </button>
            <span className="ml-auto text-[10px] text-gray-300 tabular-nums">
              {folderCount} folder{folderCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* ── Tree body ── */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">

          {loading ? (
            <div className="px-2 py-3 space-y-1.5 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-7 bg-gray-100 rounded-xl"
                  style={{ marginLeft: `${(i % 3) * 12}px`, opacity: 1 - i * 0.15 }}
                />
              ))}
            </div>
          ) : (
            <ul className="space-y-0.5">

              {/* All Files root item */}
              <li>
                <div
                  className={`flex items-center gap-2 py-1.5 px-2 rounded-xl cursor-pointer transition-colors mb-1 ${
                    !currentFolderId
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  onClick={() => typeof onFolderSelect === 'function' && onFolderSelect(null, 'All Files', '/')}
                >
                  <span className="w-4 h-4 shrink-0" /> {/* indent placeholder */}
                  <Home className={`w-4 h-4 shrink-0 ${!currentFolderId ? 'text-blue-500' : 'text-gray-400'}`} />
                  <span className="text-sm">All Files</span>
                </div>
              </li>

              {/* Folder tree */}
              {treeNodes}

              {/* Empty state */}
              {!loading && hasAnyFolders && matchingIds && matchingIds.size === 0 && (
                <li className="py-6 text-center">
                  <p className="text-xs text-gray-400">No folders match "{searchQuery}"</p>
                  <button onClick={() => setSearchQuery('')} className="text-xs text-blue-500 hover:underline mt-1">
                    Clear search
                  </button>
                </li>
              )}

              {!loading && !hasAnyFolders && (
                <li className="py-8 text-center px-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-2">
                    <Folder className="w-5 h-5 text-gray-300" />
                  </div>
                  <p className="text-xs text-gray-400">No folders yet</p>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* ── New Folder button (pinned to bottom) ── */}
        <div className="px-3 py-3 border-t border-gray-100 shrink-0">
          <button
            onClick={() => typeof onCreateFolder === 'function' && onCreateFolder(currentFolderId)}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-200 rounded-xl transition-all"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            New Folder
            {currentFolderId && (
              <span className="ml-auto text-[10px] font-normal text-gray-400">inside current</span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}