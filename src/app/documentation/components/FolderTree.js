'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, Plus, MoreVertical, Edit2, Trash2, FolderPlus } from 'lucide-react';

export default function FolderTree({ 
  projectId, 
  currentFolderId, 
  onFolderSelect, 
  onCreateFolder,
  refreshTrigger 
}) {
  const [folders, setFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState({ show: false, folderId: null, x: 0, y: 0 });

  useEffect(() => {
    fetchFolders();
  }, [projectId, refreshTrigger]);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/documentation/folders?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setFolders(data);
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleContextMenu = (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      show: true,
      folderId,
      x: e.clientX,
      y: e.clientY
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ show: false, folderId: null, x: 0, y: 0 });
  };

  useEffect(() => {
    const handleClick = () => closeContextMenu();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const buildFolderTree = (parentId = null) => {
    const childFolders = folders.filter(f => {
      if (parentId === null) {
        return f.parentId === null || f.parentId === undefined;
      }
      return f.parentId?.toString() === parentId?.toString();
    });

    if (childFolders.length === 0) return null;

    return (
      <ul className={`${parentId ? 'ml-4 border-l border-gray-200' : ''}`}>
        {childFolders.map(folder => {
          const isExpanded = expandedFolders.has(folder._id);
          const isSelected = currentFolderId === folder._id;
          const hasChildren = folders.some(f => f.parentId?.toString() === folder._id?.toString());

          return (
            <li key={folder._id} className="relative">
              <div 
                className={`flex items-center py-1.5 px-2 cursor-pointer rounded-md group transition-colors ${
                  isSelected 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => {
                  onFolderSelect(folder._id, folder.name, folder.path);
                  if (hasChildren) toggleFolder(folder._id);
                }}
                onContextMenu={(e) => handleContextMenu(e, folder._id)}
              >
                {/* Expand/Collapse Icon */}
                <span className="w-4 h-4 flex items-center justify-center mr-1">
                  {hasChildren ? (
                    isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                    )
                  ) : null}
                </span>

                {/* Folder Icon */}
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 mr-2 text-yellow-500" />
                ) : (
                  <Folder className="w-4 h-4 mr-2 text-yellow-500" />
                )}

                {/* Folder Name */}
                <span className="text-sm truncate flex-1">{folder.name}</span>

                {/* Actions */}
                <button
                  onClick={(e) => handleContextMenu(e, folder._id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 transition-opacity"
                >
                  <MoreVertical className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>

              {/* Children */}
              {isExpanded && buildFolderTree(folder._id)}
            </li>
          );
        })}
      </ul>
    );
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 ml-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2">
      {/* Root/All Files */}
      <div 
        className={`flex items-center py-1.5 px-2 cursor-pointer rounded-md mb-1 ${
          !currentFolderId 
            ? 'bg-blue-100 text-blue-700' 
            : 'hover:bg-gray-100'
        }`}
        onClick={() => onFolderSelect(null, 'All Files', '/')}
      >
        <Folder className="w-4 h-4 mr-2 text-blue-500" />
        <span className="text-sm font-medium">All Files</span>
      </div>

      {/* Folder Tree */}
      {buildFolderTree()}

      {/* Create Folder Button */}
      <button
        onClick={() => onCreateFolder(currentFolderId)}
        className="flex items-center mt-3 py-1.5 px-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md w-full transition-colors"
      >
        <FolderPlus className="w-4 h-4 mr-2" />
        New Folder
      </button>

      {/* Context Menu */}
      {contextMenu.show && (
        <div 
          className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-40"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              onCreateFolder(contextMenu.folderId);
              closeContextMenu();
            }}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            New Subfolder
          </button>
          <button
            onClick={() => {
              // TODO: Implement rename
              closeContextMenu();
            }}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Rename
          </button>
          <div className="border-t border-gray-100 my-1"></div>
          <button
            onClick={() => {
              // TODO: Implement delete
              closeContextMenu();
            }}
            className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
