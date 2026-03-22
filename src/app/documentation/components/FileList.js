'use client';

import React, { useState } from 'react';
import { 
  File, Folder, Download, MoreVertical, Edit2, Trash2, 
  Copy, Move, Lock, Unlock, History, Eye, Grid, List,
  FileText, FileImage, FileVideo, FileArchive, FileCode,
  ChevronRight, Share2
} from 'lucide-react';
import Image from 'next/image';

const FILE_ICONS = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  jpg: FileImage,
  jpeg: FileImage,
  png: FileImage,
  gif: FileImage,
  svg: FileImage,
  mp4: FileVideo,
  mov: FileVideo,
  avi: FileVideo,
  zip: FileArchive,
  rar: FileArchive,
  '7z': FileArchive,
  js: FileCode,
  jsx: FileCode,
  ts: FileCode,
  tsx: FileCode,
  py: FileCode,
  json: FileCode,
  html: FileCode,
  css: FileCode,
};

const getFileIcon = (fileName) => {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  return FILE_ICONS[ext] || File;
};

export default function FileList({ 
  items = [], 
  folders = [],
  viewMode = 'grid',
  onFolderClick,
  onFileClick,
  onDownload,
  onDelete,
  onRename,
  onDuplicate,
  onMove,
  onVersionHistory,
  onToggleLock,
  onShare,
  selectionMode = false,
  selectedItems = [],
  onToggleSelection,
  breadcrumbs = [],
  onBreadcrumbClick
}) {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderBreadcrumbs = () => (
    <div className="flex items-center text-sm text-gray-600 mb-4 overflow-x-auto">
      <button 
        onClick={() => onBreadcrumbClick(null)}
        className="hover:text-blue-600 whitespace-nowrap"
      >
        Root
      </button>
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.id || index}>
          <ChevronRight className="w-4 h-4 mx-1 text-gray-400 flex-shrink-0" />
          <button 
            onClick={() => onBreadcrumbClick(crumb.id)}
            className={`hover:text-blue-600 whitespace-nowrap ${
              index === breadcrumbs.length - 1 ? 'text-gray-900 font-medium' : ''
            }`}
          >
            {crumb.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {/* Folders */}
      {folders.map(folder => (
        <div
          key={folder._id}
          className={`relative group bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer ${
            selectionMode && selectedItems.includes(folder._id) ? 'ring-2 ring-blue-500' : ''
          }`}
          onClick={() => selectionMode ? onToggleSelection(folder._id) : onFolderClick(folder)}
          onMouseEnter={() => setHoveredItem(folder._id)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          {selectionMode && (
            <div className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedItems.includes(folder._id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
            }`}>
              {selectedItems.includes(folder._id) && (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          )}
          <div className="flex flex-col items-center text-center">
            <Folder className="w-12 h-12 text-yellow-500 mb-2" />
            <span className="text-sm font-medium text-gray-900 truncate w-full">{folder.name}</span>
            <span className="text-xs text-gray-500 mt-1">Folder</span>
          </div>
        </div>
      ))}

      {/* Files */}
      {items.map(item => {
        const FileIcon = getFileIcon(item.name);
        return (
          <div
            key={item._id}
            className={`relative group bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer ${
              selectionMode && selectedItems.includes(item._id) ? 'ring-2 ring-blue-500' : ''
            } ${item.isDisabled ? 'opacity-60' : ''}`}
            onClick={() => selectionMode ? onToggleSelection(item._id) : onFileClick(item)}
            onMouseEnter={() => setHoveredItem(item._id)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            {/* Selection checkbox */}
            {selectionMode && (
              <div className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedItems.includes(item._id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
              }`}>
                {selectedItems.includes(item._id) && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            )}

            {/* Status badges */}
            <div className="absolute top-2 right-2 flex flex-col gap-1">
              {item.isPasswordProtected && (
                <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-xs">
                  <Lock className="w-3 h-3" />
                </span>
              )}
              {item.currentVersion > 1 && (
                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">
                  v{item.currentVersion}
                </span>
              )}
            </div>

            <div className="flex flex-col items-center text-center">
              <FileIcon className="w-12 h-12 text-gray-400 mb-2" />
              <span className="text-sm font-medium text-gray-900 truncate w-full" title={item.name}>
                {item.name}
              </span>
              <span className="text-xs text-gray-500 mt-1">{formatFileSize(item.fileSize)}</span>
            </div>

            {/* Hover actions */}
            {!selectionMode && hoveredItem === item._id && (
              <div className="absolute inset-0 bg-black/5 rounded-lg flex items-center justify-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); onShare && onShare(item); }}
                  className="p-2 bg-white rounded-full shadow hover:bg-green-50"
                  title="Share"
                >
                  <Share2 className="w-4 h-4 text-green-600" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDownload(item); }}
                  className="p-2 bg-white rounded-full shadow hover:bg-blue-50"
                  title="Download"
                >
                  <Download className="w-4 h-4 text-gray-600" />
                </button>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setActiveDropdown(activeDropdown === item._id ? null : item._id);
                  }}
                  className="p-2 bg-white rounded-full shadow hover:bg-gray-50"
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            )}

            {/* Dropdown menu */}
            {activeDropdown === item._id && (
              <div 
                className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-40"
                onClick={(e) => e.stopPropagation()}
              >
                <button onClick={() => { onRename(item); setActiveDropdown(null); }} className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <Edit2 className="w-4 h-4 mr-2" /> Rename
                </button>
                <button onClick={() => { onDuplicate(item); setActiveDropdown(null); }} className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <Copy className="w-4 h-4 mr-2" /> Duplicate
                </button>
                <button onClick={() => { onMove(item); setActiveDropdown(null); }} className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <Move className="w-4 h-4 mr-2" /> Move
                </button>
                <button onClick={() => { onVersionHistory(item); setActiveDropdown(null); }} className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <History className="w-4 h-4 mr-2" /> Version History
                </button>
                <button onClick={() => { onToggleLock(item); setActiveDropdown(null); }} className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  {item.isPasswordProtected ? <Unlock className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                  {item.isPasswordProtected ? 'Remove Password' : 'Add Password'}
                </button>
                <div className="border-t border-gray-100 my-1"></div>
                <button onClick={() => { onDelete(item); setActiveDropdown(null); }} className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {selectionMode && <th className="w-10 px-4 py-3"></th>}
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Name</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 hidden md:table-cell">Size</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 hidden lg:table-cell">Modified</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 hidden lg:table-cell">Version</th>
            <th className="w-20 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {/* Folders */}
          {folders.map(folder => (
            <tr 
              key={folder._id} 
              className={`hover:bg-gray-50 cursor-pointer ${
                selectionMode && selectedItems.includes(folder._id) ? 'bg-blue-50' : ''
              }`}
              onClick={() => selectionMode ? onToggleSelection(folder._id) : onFolderClick(folder)}
            >
              {selectionMode && (
                <td className="px-4 py-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedItems.includes(folder._id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                  }`}>
                    {selectedItems.includes(folder._id) && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </td>
              )}
              <td className="px-4 py-3">
                <div className="flex items-center">
                  <Folder className="w-5 h-5 text-yellow-500 mr-3" />
                  <span className="text-sm font-medium text-gray-900">{folder.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">—</td>
              <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">{formatDate(folder.updatedAt)}</td>
              <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">—</td>
              <td className="px-4 py-3"></td>
            </tr>
          ))}

          {/* Files */}
          {items.map(item => {
            const FileIcon = getFileIcon(item.name);
            return (
              <tr 
                key={item._id} 
                className={`hover:bg-gray-50 cursor-pointer ${
                  selectionMode && selectedItems.includes(item._id) ? 'bg-blue-50' : ''
                } ${item.isDisabled ? 'opacity-60' : ''}`}
                onClick={() => selectionMode ? onToggleSelection(item._id) : onFileClick(item)}
              >
                {selectionMode && (
                  <td className="px-4 py-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedItems.includes(item._id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                    }`}>
                      {selectedItems.includes(item._id) && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center">
                    <FileIcon className="w-5 h-5 text-gray-400 mr-3" />
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    {item.isPasswordProtected && <Lock className="w-3.5 h-3.5 text-amber-500 ml-2" />}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{formatFileSize(item.fileSize)}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">{formatDate(item.updatedAt)}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                  {item.currentVersion ? `v${item.currentVersion}` : 'v1'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onShare && onShare(item); }}
                      className="p-1.5 rounded hover:bg-gray-100"
                      title="Share"
                    >
                      <Share2 className="w-4 h-4 text-green-600" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDownload(item); }}
                      className="p-1.5 rounded hover:bg-gray-100"
                      title="Download"
                    >
                      <Download className="w-4 h-4 text-gray-500" />
                    </button>
                    <div className="relative">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setActiveDropdown(activeDropdown === item._id ? null : item._id);
                        }}
                        className="p-1.5 rounded hover:bg-gray-100"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>
                      {activeDropdown === item._id && (
                        <div 
                          className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-40"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button onClick={() => { onRename(item); setActiveDropdown(null); }} className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            <Edit2 className="w-4 h-4 mr-2" /> Rename
                          </button>
                          <button onClick={() => { onDuplicate(item); setActiveDropdown(null); }} className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            <Copy className="w-4 h-4 mr-2" /> Duplicate
                          </button>
                          <button onClick={() => { onMove(item); setActiveDropdown(null); }} className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            <Move className="w-4 h-4 mr-2" /> Move
                          </button>
                          <button onClick={() => { onVersionHistory(item); setActiveDropdown(null); }} className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            <History className="w-4 h-4 mr-2" /> Version History
                          </button>
                          <div className="border-t border-gray-100 my-1"></div>
                          <button onClick={() => { onDelete(item); setActiveDropdown(null); }} className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {folders.length === 0 && items.length === 0 && (
        <div className="text-center py-12">
          <File className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No files or folders here</p>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {breadcrumbs.length > 0 && renderBreadcrumbs()}
      {viewMode === 'grid' ? renderGridView() : renderListView()}
    </div>
  );
}
