'use client';

import { useState, useEffect } from 'react';
import { Folder, ChevronRight, ChevronDown } from 'lucide-react';

export default function FolderTree({ roomId, currentFolder, onFolderClick }) {
  const [folders, setFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (roomId) {
      fetchFolders();
    }
  }, [roomId]);

  async function fetchFolders() {
    try {
      const response = await fetch(`/api/dataroom/folders?roomId=${roomId}`);
      if (response.ok) {
        const data = await response.json();
        const tree = buildFolderTree(data.folders || []);
        setFolders(tree);
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    } finally {
      setLoading(false);
    }
  }

  function buildFolderTree(folders) {
    const folderMap = {};
    const tree = [];

    // Create a map of all folders
    folders.forEach(folder => {
      folderMap[folder._id] = { ...folder, children: [] };
    });

    // Build the tree structure
    folders.forEach(folder => {
      if (folder.parentId && folderMap[folder.parentId]) {
        folderMap[folder.parentId].children.push(folderMap[folder._id]);
      } else {
        tree.push(folderMap[folder._id]);
      }
    });

    return tree;
  }

  function toggleFolder(folderId) {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  }

  function renderFolder(folder, level = 0) {
    const isExpanded = expandedFolders.has(folder._id);
    const isActive = currentFolder === folder._id;
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <div key={folder._id}>
        <div
          className={`flex items-center space-x-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-100 ${
            isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleFolder(folder._id);
            }
            onFolderClick(folder._id);
          }}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder._id);
              }}
              className="p-0.5"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          )}
          {!hasChildren && <span className="w-4" />}
          <Folder className="w-4 h-4" />
          <span className="text-sm truncate flex-1">{folder.name}</span>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {folder.children.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-slate-200 rounded"></div>
          <div className="h-6 bg-slate-200 rounded"></div>
          <div className="h-6 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center space-x-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-100 ${
          currentFolder === null ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
        }`}
        onClick={() => onFolderClick(null)}
      >
        <Folder className="w-4 h-4" />
        <span className="text-sm font-medium">Root</span>
      </div>
      {folders.map(folder => renderFolder(folder))}
    </div>
  );
}
