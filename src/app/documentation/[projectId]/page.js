'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ChevronLeft, Upload, Search, Grid, List, Plus, Filter,
  Folder, FolderPlus, Settings, Users, Activity, Clock,
  MoreVertical, Download, Trash2, CheckSquare, X, RefreshCw,
  Play, Pause, Lightbulb, Archive, XCircle, FileText
} from 'lucide-react';
import FolderTree from '../components/FolderTree';
import FileList from '../components/FileList';
import ActivityLog from '../components/ActivityLog';
import VersionHistory from '../components/VersionHistory';
import UploadModal from '../components/UploadModal';
import FolderContextMenu from '../components/FolderContextMenu';

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700', icon: Play },
  ideation: { label: 'Ideation', color: 'bg-purple-100 text-purple-700', icon: Lightbulb },
  paused: { label: 'Paused', color: 'bg-yellow-100 text-yellow-700', icon: Pause },
  shelved: { label: 'Shelved', color: 'bg-gray-100 text-gray-700', icon: Archive },
  archived: { label: 'Archived', color: 'bg-slate-100 text-slate-700', icon: Archive },
  dismissed: { label: 'Dismissed', color: 'bg-red-100 text-red-700', icon: XCircle }
};

export default function ProjectDocumentationPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId;

  // State
  const [project, setProject] = useState(null);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeTab, setActiveTab] = useState('files'); // files, activity, settings
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Modals
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderDetails, setShowFolderDetails] = useState(false);
  const [showFolderPermissions, setShowFolderPermissions] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [parentFolderIdForNew, setParentFolderIdForNew] = useState(null);

  // Fetch project details
  useEffect(() => {
    const loadProject = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (response.ok) {
          const data = await response.json();
          setProject(data);
        }
      } catch (error) {
        console.error('Error fetching project:', error);
      }
    };
    
    if (projectId) {
      loadProject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Fetch files and folders when folder changes
  useEffect(() => {
    const loadContents = async () => {
      try {
        setLoading(true);

        // Fetch folders - only children of current folder (or root if none)
        const foldersQuery = currentFolderId
          ? `/api/documentation/folders?projectId=${projectId}&parentId=${currentFolderId}`
          : `/api/documentation/folders?projectId=${projectId}&parentId=`;
        const foldersResponse = await fetch(foldersQuery);
        if (foldersResponse.ok) {
          const foldersData = await foldersResponse.json();
          setFolders(foldersData);
        }

        // Fetch files
        const filesQuery = currentFolderId
          ? `/api/resources?projectId=${projectId}&folderId=${currentFolderId}`
          : `/api/resources?projectId=${projectId}`;
        const filesResponse = await fetch(filesQuery);
        if (filesResponse.ok) {
          const filesData = await filesResponse.json();
          setFiles(filesData.filter(f => !currentFolderId || f.folderId === currentFolderId));
        }
      } catch (error) {
        console.error('Error fetching contents:', error);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadContents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, currentFolderId, refreshTrigger]);

  const fetchProject = async () => {
    try {
      if (projectId === 'general') {
        setProject({ _id: 'general', name: 'General', description: 'General documents' });
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProject(data);
      } else {
        router.push('/documentation');
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      router.push('/documentation');
    } finally {
      setLoading(false);
    }
  };

  const fetchContents = async () => {
    try {
      // Fetch folders
      const foldersRes = await fetch(`/api/documentation/folders?projectId=${projectId}&parentId=${currentFolderId || ''}`);
      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        setFolders(foldersData);
      }

      // Fetch files (resources)
      let url = `/api/resources?projectId=${projectId}`;
      if (currentFolderId) {
        url += `&folderId=${currentFolderId}`;
      }
      const filesRes = await fetch(url);
      if (filesRes.ok) {
        const filesData = await filesRes.json();
        // Filter files that belong to current folder
        const filteredFiles = filesData.filter(f => {
          if (currentFolderId) {
            return f.folderId === currentFolderId;
          }
          return !f.folderId;
        });
        setFiles(filteredFiles);
      }
    } catch (error) {
      console.error('Error fetching contents:', error);
    }
  };

  const handleFolderSelect = async (folderId, folderName, path) => {
    setCurrentFolderId(folderId);
    setCurrentPath(path || '/');

    // Update breadcrumbs by fetching the full folder hierarchy
    if (!folderId) {
      setBreadcrumbs([]);
    } else {
      // Build breadcrumbs by traversing up the folder tree
      const buildBreadcrumbs = async (fid) => {
        const crumbs = [];
        let currentId = fid;

        while (currentId) {
          try {
            const res = await fetch(`/api/documentation/folders/${currentId}`);
            if (res.ok) {
              const folder = await res.json();
              crumbs.unshift({ id: folder._id, name: folder.name });
              currentId = folder.parentId;
            } else {
              break;
            }
          } catch (err) {
            console.error('Error fetching folder:', err);
            break;
          }
        }

        setBreadcrumbs(crumbs);
      };

      buildBreadcrumbs(folderId);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch('/api/documentation/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          projectId,
          parentId: parentFolderIdForNew
        })
      });

      if (response.ok) {
        setNewFolderName('');
        setShowCreateFolderModal(false);
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const openCreateFolderModal = (folder = null) => {
    // If folder object is passed, extract its _id; otherwise use currentFolderId
    const parentId = folder?._id || currentFolderId;
    setParentFolderIdForNew(parentId);
    setNewFolderName('');
    setShowCreateFolderModal(true);
  };

  const handleFolderClick = (folder) => {
    handleFolderSelect(folder._id, folder.name, folder.path);
  };

  const handleFileClick = (file) => {
    // Preview or details
    console.log('File clicked:', file);
  };

  const handleDownload = async (item) => {
    // Download file
    window.open(`/api/download/${item.fileId}`, '_blank');
  };

  const handleDelete = async (item) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    
    try {
      const response = await fetch(`/api/resources/${item._id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleFolderRename = async (folder, newName) => {
    try {
      const response = await fetch(`/api/documentation/folders/${folder._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (response.ok) {
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error renaming folder:', error);
    }
  };

  const handleFolderDelete = async (folder) => {
    try {
      const response = await fetch(`/api/documentation/folders/${folder._id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setRefreshTrigger(prev => prev + 1);
        if (currentFolderId === folder._id) {
          setCurrentFolderId(null);
        }
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
    }
  };

  const handleFolderPermissions = (folder) => {
    setSelectedFolder(folder);
    setShowFolderPermissions(true);
  };

  const handleFolderDetails = (folder) => {
    setSelectedFolder(folder);
    setShowFolderDetails(true);
  };

  const handleFileShare = async (file) => {
    // Generate shareable link
    const shareUrl = `${window.location.origin}/shared/${file._id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
    } catch (err) {
      prompt('Copy this link:', shareUrl);
    }
  };

  const [lockModal, setLockModal] = useState({ show: false, file: null, mode: 'add', password: '', confirmPassword: '' });

  const handleToggleLock = (file) => {
    if (file.isPasswordProtected) {
      // Remove password - prompt for confirmation
      if (confirm(`Remove password protection from "${file.name}"?`)) {
        handleRemovePassword(file);
      }
    } else {
      // Add password - show modal
      setLockModal({ show: true, file, mode: 'add' });
    }
  };

  const handleRemovePassword = async (file) => {
    try {
      const response = await fetch(`/api/resources/${file._id}/protect`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removePassword: true })
      });
      if (response.ok) {
        setRefreshTrigger(prev => prev + 1);
        alert('Password protection removed');
      } else {
        alert('Failed to remove password protection');
      }
    } catch (error) {
      console.error('Error removing password:', error);
      alert('Failed to remove password protection');
    }
  };

  const handleSetPassword = async () => {
    const { file, mode } = lockModal;
    if (!file) return;

    try {
      const response = await fetch(`/api/resources/${file._id}/protect`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: lockModal.password,
          confirmPassword: lockModal.confirmPassword
        })
      });
      if (response.ok) {
        setRefreshTrigger(prev => prev + 1);
        setLockModal({ show: false, file: null, mode: 'add' });
        alert('Password protection added successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to add password protection');
      }
    } catch (error) {
      console.error('Error setting password:', error);
      alert('Failed to add password protection');
    }
  };

  const handleVersionHistory = (item) => {
    setSelectedResource(item);
    setShowVersionHistory(true);
  };

  const toggleSelection = (itemId) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedItems.length} selected items?`)) return;
    
    try {
      await Promise.all(
        selectedItems.map(id => 
          fetch(`/api/resources/${id}`, { method: 'DELETE' })
        )
      );
      setSelectedItems([]);
      setSelectionMode(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error bulk deleting:', error);
    }
  };

  // Filter items by search
  const filteredFolders = folders.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const status = project?.status || 'active';
  const StatusIcon = STATUS_CONFIG[status]?.icon || Play;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left */}
            <div className="flex items-center gap-4">
              <Link 
                href="/documentation"
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </Link>
              
              <div className="flex items-center gap-3">
                {project?.logo ? (
                  <img src={project.logo} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Folder className="w-5 h-5 text-white" />
                  </div>
                )}
                <div>
                  <h1 className="font-semibold text-gray-900">{project?.name}</h1>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_CONFIG[status]?.color}`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {STATUS_CONFIG[status]?.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 mt-4 -mb-px">
            <button
              onClick={() => setActiveTab('files')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'files'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1.5" />
              Files
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'activity'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Activity className="w-4 h-4 inline mr-1.5" />
              Activity
            </button>
            {projectId !== 'general' && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'settings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-1.5" />
                Settings
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex">
        {/* Sidebar - Folder Tree */}
        {activeTab === 'files' && showSidebar && (
          <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-120px)] hidden lg:block">
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Folders
              </h3>
              <FolderTree
                projectId={projectId}
                currentFolderId={currentFolderId}
                onFolderSelect={handleFolderSelect}
                onCreateFolder={openCreateFolderModal}
                onRenameFolder={handleFolderRename}
                onDeleteFolder={handleFolderDelete}
                onFolderPermissions={handleFolderPermissions}
                onFolderDetails={handleFolderDetails}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </aside>
        )}

        {/* Main Area */}
        <main className="flex-1 p-4 lg:p-6">
          {activeTab === 'files' && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Search */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search files and folders..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* New Folder */}
                  <button
                    onClick={() => openCreateFolderModal()}
                    className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">New Folder</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Selection Mode */}
                  <button
                    onClick={() => {
                      setSelectionMode(!selectionMode);
                      setSelectedItems([]);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      selectionMode ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <CheckSquare className="w-5 h-5" />
                  </button>

                  {/* View Mode */}
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                    >
                      <Grid className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                    >
                      <List className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>

                  {/* Refresh */}
                  <button
                    onClick={() => setRefreshTrigger(prev => prev + 1)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Selection Actions */}
              {selectionMode && selectedItems.length > 0 && (
                <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-blue-700">
                    {selectedItems.length} selected
                  </span>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 bg-white rounded border border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                  <button
                    onClick={() => {
                      setSelectedItems([]);
                      setSelectionMode(false);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 bg-white rounded border border-gray-200 hover:bg-gray-50"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              )}

              {/* File List */}
              <FileList
                items={filteredFiles}
                folders={filteredFolders}
                viewMode={viewMode}
                onFolderClick={handleFolderClick}
                onFileClick={handleFileClick}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onRename={() => {}}
                onDuplicate={() => {}}
                onMove={() => {}}
                onVersionHistory={handleVersionHistory}
                onToggleLock={handleToggleLock}
                onShare={handleFileShare}
                selectionMode={selectionMode}
                selectedItems={selectedItems}
                onToggleSelection={toggleSelection}
                breadcrumbs={breadcrumbs}
                onBreadcrumbClick={(id) => {
                  if (!id) {
                    handleFolderSelect(null, 'All Files', '/');
                  } else {
                    const folder = folders.find(f => f._id === id);
                    if (folder) {
                      handleFolderClick(folder);
                    }
                  }
                }}
              />
            </>
          )}

          {activeTab === 'activity' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <ActivityLog projectId={projectId} limit={50} showHeader={true} />
            </div>
          )}

          {activeTab === 'settings' && projectId !== 'general' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Settings</h2>
              
              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Basic Information</h3>
                  <div className="grid gap-4 max-w-lg">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Project Name</label>
                      <input
                        type="text"
                        value={project?.name || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Description</label>
                      <textarea
                        value={project?.description || ''}
                        disabled
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Members */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Team Members</h3>
                  <div className="flex flex-wrap gap-2">
                    {project?.members?.map((member, index) => (
                      <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                          {member.user?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <span className="text-sm text-gray-700">{member.user}</span>
                        <span className="text-xs text-gray-500">({member.role})</span>
                      </div>
                    ))}
                    {(!project?.members || project.members.length === 0) && (
                      <p className="text-sm text-gray-500">No members assigned</p>
                    )}
                  </div>
                </div>

                {/* Link to full project settings */}
                <div className="pt-4 border-t border-gray-200">
                  <Link
                    href={`/project_management/${projectId}`}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Go to full project settings →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Folder</h2>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCreateFolderModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      <VersionHistory
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        resourceId={selectedResource?._id}
        resourceName={selectedResource?.name}
        onRevert={() => setRefreshTrigger(prev => prev + 1)}
        onDownloadVersion={(version) => {
          window.open(`/api/download/${version.fileId}`, '_blank');
        }}
      />

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={() => {
          setRefreshTrigger(prev => prev + 1);
          setShowUploadModal(false);
        }}
        defaultProjectId={projectId}
        defaultFolderId={currentFolderId}
        userProjects={[]}
      />

      {/* Folder Permissions Modal */}
      {showFolderPermissions && selectedFolder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowFolderPermissions(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Folder Permissions - {selectedFolder.name}</h3>
            <p className="text-gray-600 mb-4">Folder permission management coming soon...</p>
            <button onClick={() => setShowFolderPermissions(false)} className="px-4 py-2 bg-gray-600 text-white rounded-lg">Close</button>
          </div>
        </div>
      )}

      {/* Folder Details Modal */}
      {showFolderDetails && selectedFolder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowFolderDetails(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Folder Details - {selectedFolder.name}</h3>
            <div className="space-y-3">
              <div><strong>Path:</strong> {selectedFolder.path || '/'}</div>
              <div><strong>Parent:</strong> {selectedFolder.parentId || 'Root'}</div>
              <div><strong>Created:</strong> {selectedFolder.createdAt ? new Date(selectedFolder.createdAt).toLocaleString() : 'N/A'}</div>
            </div>
            <button onClick={() => setShowFolderDetails(false)} className="mt-6 px-4 py-2 bg-gray-600 text-white rounded-lg">Close</button>
          </div>
        </div>
      )}

      {/* Lock/Unlock Password Modal */}
      {lockModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setLockModal({ show: false, file: null, mode: 'add' })}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2">Add Password Protection</h3>
            <p className="text-sm text-gray-500 mb-4">"{lockModal.file?.name}"</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={lockModal.password || ''}
                  onChange={(e) => setLockModal(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={lockModal.confirmPassword || ''}
                  onChange={(e) => setLockModal(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setLockModal({ show: false, file: null, mode: 'add' })}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSetPassword}
                disabled={!lockModal.password || lockModal.password !== lockModal.confirmPassword}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Set Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
