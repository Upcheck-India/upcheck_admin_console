'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Upload, Search, Grid, List, Plus, Filter, Link2,
  Folder, FolderPlus, Settings, Users, Activity, Clock,
  MoreVertical, AlertTriangle, Download, Trash2, CheckSquare, X, RefreshCw,
  Play, Pause, Lightbulb, Archive, XCircle, FileText, SortAsc
} from 'lucide-react';
import FolderTree from '../components/FolderTree';
import FileList from '../components/FileList';
import ActivityLog from '../components/ActivityLog';
import VersionHistory from '../components/VersionHistory';
import UploadModal from '../components/UploadModal';
import FolderContextMenu from '../components/FolderContextMenu';
import FolderDeleteConfirmModal from '../components/FolderDeleteConfirmModal';
import FileDeleteConfirmModal from '../components/FileDeleteConfirmModal';
import ProjectDeleteConfirmModal from '../components/ProjectDeleteConfirmModal';
import DocumentViewer from '../components/DocumentViewer';
import ShareModal from '../components/ShareModal';
import ProjectSettings from '../components/ProjectSettings';
import ProjectMembers from '../components/ProjectMembers';
import MoveModal from '../components/MoveModal';
import ShareLinksModal from '../components/ShareLinksModal';
import CreateFileModal from '../components/CreateFileModal';
import FileEditor from '../components/FileEditor';
import MarkdownViewer from '../components/MarkdownViewer';

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
  const [activeTab, setActiveTab] = useState('files'); // files, activity, members, settings
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sortBy, setSortBy] = useState('name_asc'); // name_asc, name_desc, modified_desc, modified_asc
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Modals
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showShareLinksModal, setShowShareLinksModal] = useState(false);
  const [showFolderDetails, setShowFolderDetails] = useState(false);
  const [showFolderPermissions, setShowFolderPermissions] = useState(false);
  const [showCreateFileModal, setShowCreateFileModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [parentFolderIdForNew, setParentFolderIdForNew] = useState(null);
  const [viewingFile, setViewingFile] = useState(null);
  const [editingFile, setEditingFile] = useState(null);
  const [sharingFile, setSharingFile] = useState(null);
  const [projectError, setProjectError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [memberRole, setMemberRole] = useState(null);

  // Delete confirmation modals
  const [folderDeleteConfirm, setFolderDeleteConfirm] = useState({ show: false, folder: null });
  const [projectDeleteConfirm, setProjectDeleteConfirm] = useState({ show: false, project: null });
  const [fileDeleteConfirm, setFileDeleteConfirm] = useState({ show: false, file: null });
  const [massMoveModal, setMassMoveModal] = useState({ show: false, items: [], stats: null });

  // Fetch project details
  useEffect(() => {
    const loadProject = async () => {
      try {
        if (projectId === 'general') {
          setProject({ _id: 'general', name: 'General', description: 'General documents' });
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/projects/${projectId}`);
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 404) {
            setProjectError('Project not found');
          } else if (response.status === 403) {
            setProjectError('You do not have access to this project');
          } else if (response.status === 401) {
            setProjectError('Please log in to access this project');
          } else {
            setProjectError(data.error || 'Failed to load project');
          }
        } else {
          setProject(data);
        }
      } catch (error) {
        console.error('Error fetching project:', error);
        setProjectError('Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadProject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
          setUserRole(data.user?.role);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUser();
  }, []);

  // Fetch member role when project loads
  useEffect(() => {
    if (project?.members && currentUser?.username) {
      const memberRecord = project.members.find(m => m.user === currentUser.username);
      setMemberRole(memberRecord?.role || null);
    } else {
      setMemberRole(null);
    }
  }, [project?.members, currentUser?.username]);

  // Fetch files and folders when folder changes
  useEffect(() => {
    const loadContents = async () => {
      try {
        setLoading(true);

        // Fetch folders - only children of current folder (or root if none)
        const foldersQuery = currentFolderId
          ? `/api/documentation/folders?projectId=${projectId}&parentId=${currentFolderId}`
          : `/api/documentation/folders?projectId=${projectId}`;
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
          // Only show files that belong to current folder (or root files when at home)
          setFiles(filesData.filter(f =>
            currentFolderId ? f.folderId === currentFolderId : (!f.folderId || f.folderId === null)
          ));
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

  const handleCreateFile = async (file) => {
    setRefreshTrigger(prev => prev + 1);
    setShowCreateFileModal(false);
  };

  const handleFileViewOrEdit = (file) => {
    // Check if it's a markdown file
    const isMarkdown = file.fileType === 'md' || file.mimeType === 'text/markdown';

    if (isMarkdown) {
      // Use MarkdownViewer for markdown files
      const canEdit = userRole === 'Admin' || userRole === 'Console admin' ||
                      memberRole === 'Project Manager' || memberRole === 'Contributor';
      if (canEdit) {
        setEditingFile(file);
      } else {
        setViewingFile(file);
      }
      return;
    }

    // Check if it's a created inline file (txt or docx)
    const isInlineFile = file.fileType === 'txt' || file.fileType === 'docx' ||
                         file.mimeType === 'text/plain' ||
                         file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (isInlineFile) {
      // For DOCX files, always use DocumentViewer (which has mammoth.js viewer)
      // For TXT files, use FileEditor for editing
      const isDocx = file.fileType === 'docx' ||
                     file.mimeType?.includes('wordprocessingml');

      if (isDocx) {
        // Use DocumentViewer for DOCX files
        setViewingFile(file);
      } else {
        // For TXT files, check if user can edit
        const canEdit = userRole === 'Admin' || userRole === 'Console admin' ||
                        memberRole === 'Project Manager' || memberRole === 'Contributor';

        if (canEdit) {
          setEditingFile(file);
        } else {
          setViewingFile(file);
        }
      }
    } else {
      // Use default document viewer for other file types
      setViewingFile(file);
    }
  };

  const handleFileSave = () => {
    setRefreshTrigger(prev => prev + 1);
    setEditingFile(null);
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
    // Open file viewer
    setViewingFile(file);
  };

  const handleDownload = async (item) => {
    // Download file
    window.open(`/api/download/${item.fileId}`, '_blank');
  };

  const handleDelete = async (item, isFolder = false) => {
    if (isFolder) {
      setFolderDeleteConfirm({ show: true, folder: item });
    } else {
      setFileDeleteConfirm({ show: true, file: item });
    }
  };

  const handleFileDeleteConfirm = async (file) => {
    try {
      const response = await fetch(`/api/resources/${file._id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setRefreshTrigger(prev => prev + 1);
        setFileDeleteConfirm({ show: false, file: null });
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
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
        setFolderDeleteConfirm({ show: false, folder: null });
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete folder');
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Failed to delete folder');
    }
  };

  const handleFolderDeleteClick = (folder) => {
    setFolderDeleteConfirm({ show: true, folder });
  };

  const handleFolderMassMove = (folder, preview) => {
    // Open mass move modal with folder contents
    setMassMoveModal({
      show: true,
      type: 'folder',
      item: folder,
      stats: preview?.stats,
      items: [...(preview?.subfolders || []), ...(preview?.files || [])],
    });
    setFolderDeleteConfirm({ show: false, folder: null });
  };

  const handleProjectDelete = async (project) => {
    try {
      const response = await fetch(`/api/projects/${project._id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setProjectDeleteConfirm({ show: false, project: null });
        // Redirect to documentation page
        router.push('/documentation');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    }
  };

  const handleProjectDeleteClick = (project) => {
    setProjectDeleteConfirm({ show: true, project });
  };

  const handleProjectMassMove = (project, preview) => {
    // Open mass move modal with project contents
    setMassMoveModal({
      show: true,
      type: 'project',
      item: project,
      stats: preview?.stats,
      items: [...(preview?.folders || []), ...(preview?.files || [])],
    });
    setProjectDeleteConfirm({ show: false, project: null });
  };

  const handleProjectArchive = async (project) => {
    try {
      const response = await fetch(`/api/projects/${project._id}/archive`, {
        method: 'PUT'
      });
      if (response.ok) {
        setProjectDeleteConfirm({ show: false, project: null });
        // Refresh project data
        fetchProject();
        alert('Project archived successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to archive project');
      }
    } catch (error) {
      console.error('Error archiving project:', error);
      alert('Failed to archive project');
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

  const handleFileShare = (file) => {
    setSharingFile(file);
  };

  const handleOpenExternally = async (file) => {
    // Open file in Microsoft Office Online Viewer or Google Docs Viewer
    const isDocx = file.fileType === 'docx' || file.mimeType?.includes('wordprocessingml');
    const isXlsx = file.fileType === 'xlsx' || file.mimeType?.includes('spreadsheetml');
    const isPptx = file.fileType === 'pptx' || file.mimeType?.includes('presentationml');
    const isPdf = file.fileType === 'pdf' || file.mimeType?.includes('pdf');

    if (isDocx || isXlsx || isPptx || isPdf) {
      try {
        // Generate a temporary public URL
        const response = await fetch(`/api/resources/${file._id}/public-view`);
        const data = await response.json();

        if (response.ok && data.publicUrl) {
          const publicUrl = data.publicUrl;

          // Determine which viewer to use
          if (isDocx || isXlsx || isPptx) {
            // Microsoft Office Online Viewer
            const viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(publicUrl)}`;
            window.open(viewerUrl, '_blank');
          } else if (isPdf) {
            // Google Docs Viewer for PDF
            const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(publicUrl)}&embedded=true`;
            window.open(viewerUrl, '_blank');
          }

          // Notify user about token expiration
          setTimeout(() => {
            alert(`Note: The external viewer link will expire in 1 hour. Refresh the page to generate a new link.`);
          }, 1000);
        } else {
          alert('Failed to generate public view URL. Please try downloading the file instead.');
        }
      } catch (error) {
        console.error('Error generating public view URL:', error);
        alert('Failed to open in external viewer. Please download the file instead.');
      }
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

  const handleFileRename = async (file, newName) => {
    try {
      const response = await fetch(`/api/resources/${file._id}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (response.ok) {
        setRefreshTrigger(prev => prev + 1);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to rename file');
      }
    } catch (error) {
      console.error('Error renaming:', error);
      alert('Failed to rename file');
    }
  };

  const handleFileDuplicate = async (file) => {
    try {
      const response = await fetch(`/api/resources/${file._id}/duplicate`, {
        method: 'POST'
      });
      if (response.ok) {
        setRefreshTrigger(prev => prev + 1);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to duplicate file');
      }
    } catch (error) {
      console.error('Error duplicating:', error);
      alert('Failed to duplicate file');
    }
  };

  const [moveModal, setMoveModal] = useState({ show: false, file: null });

  const handleFileMove = async (file, targetProjectId, targetFolderId) => {
    try {
      const response = await fetch(`/api/resources/${file._id}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: targetProjectId,
          folderId: targetFolderId
        })
      });
      if (response.ok) {
        setRefreshTrigger(prev => prev + 1);
        setMoveModal({ show: false, file: null });
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to move file');
      }
    } catch (error) {
      console.error('Error moving:', error);
      alert('Failed to move file');
    }
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
  ).sort((a, b) => {
    switch (sortBy) {
      case 'name_asc': return a.name.localeCompare(b.name);
      case 'name_desc': return b.name.localeCompare(a.name);
      case 'modified_desc': return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      case 'modified_asc': return new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt);
      default: return 0;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header Skeleton */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="px-4 lg:px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 animate-pulse" />
                <div className="space-y-2">
                  <div className="w-40 h-5 bg-gray-100 rounded-md animate-pulse" />
                  <div className="w-24 h-4 bg-gray-100 rounded-md animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Skeleton */}
        <main className="p-4 lg:p-6">
          {/* Toolbar Skeleton */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-48 h-10 bg-gray-100 rounded-lg animate-pulse" />
              <div className="w-8 h-10 bg-gray-100 rounded-lg animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20 h-10 bg-gray-100 rounded-lg animate-pulse" />
              <div className="w-20 h-10 bg-gray-100 rounded-lg animate-pulse" />
              <div className="w-10 h-10 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-8 bg-gray-100 rounded w-full" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Error</h2>
          <p className="text-gray-600 mb-6">{projectError}</p>
          <Link
            href="/documentation"
            className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Documentation
          </Link>
        </div>
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
                {project?.logo && (project.logo.startsWith('/') || project.logo.startsWith('http://') || project.logo.startsWith('https://') || project.logo.startsWith('data:')) ? (
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
              {/* Check if user can create files */}
              {(userRole === 'Admin' || userRole === 'Console admin' ||
                memberRole === 'Project Manager' || memberRole === 'Contributor') && (
                <button
                  onClick={() => setShowCreateFileModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Create File</span>
                </button>
              )}
              <button
                onClick={() => setShowShareLinksModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Link2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share Links</span>
              </button>
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
              <>
                <button
                  onClick={() => setActiveTab('members')}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'members'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Users className="w-4 h-4 inline mr-1.5" />
                  Members
                </button>
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
              </>
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

                  {/* Sort */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSortMenu(!showSortMenu)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <SortAsc className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700 hidden sm:inline">
                        {sortBy === 'name_asc' ? 'Name A–Z' : sortBy === 'name_desc' ? 'Name Z–A' : sortBy === 'modified_desc' ? 'Last Modified' : 'Oldest'}
                      </span>
                    </button>
                    {showSortMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
                          <button
                            onClick={() => { setSortBy('name_asc'); setShowSortMenu(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${sortBy === 'name_asc' ? 'text-blue-600' : 'text-gray-700'}`}
                          >
                            Name A–Z
                            {sortBy === 'name_asc' && <CheckSquare className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => { setSortBy('name_desc'); setShowSortMenu(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${sortBy === 'name_desc' ? 'text-blue-600' : 'text-gray-700'}`}
                          >
                            Name Z–A
                            {sortBy === 'name_desc' && <CheckSquare className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => { setSortBy('modified_desc'); setShowSortMenu(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${sortBy === 'modified_desc' ? 'text-blue-600' : 'text-gray-700'}`}
                          >
                            Last Modified
                            {sortBy === 'modified_desc' && <CheckSquare className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => { setSortBy('modified_asc'); setShowSortMenu(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${sortBy === 'modified_asc' ? 'text-blue-600' : 'text-gray-700'}`}
                          >
                            Oldest Modified
                            {sortBy === 'modified_asc' && <CheckSquare className="w-4 h-4" />}
                          </button>
                        </div>
                      </>
                    )}
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
                onFileClick={handleFileViewOrEdit}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onRename={handleFileRename}
                onRenameFolder={handleFolderRename}
                onDuplicate={handleFileDuplicate}
                onMove={(file) => setMoveModal({ show: true, file })}
                onVersionHistory={handleVersionHistory}
                onToggleLock={handleToggleLock}
                onShare={handleFileShare}
                onOpenExternally={handleOpenExternally}
                selectionMode={selectionMode}
                selectedItems={selectedItems}
                onToggleSelection={toggleSelection}
                breadcrumbs={breadcrumbs}
                onBreadcrumbClick={(id, name, index) => {
                  if (!id) {
                    // Home clicked
                    handleFolderSelect(null, 'Home', '/');
                  } else {
                    // Navigate to clicked folder and rebuild breadcrumbs up to that point
                    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
                    const path = '/' + newBreadcrumbs.map(b => b.name).join('/');
                    handleFolderSelect(id, name, path);
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

          {activeTab === 'members' && projectId !== 'general' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <ProjectMembers
                project={project}
                onMembersUpdate={(updatedMembers) => {
                  setProject({ ...project, members: updatedMembers });
                }}
              />
            </div>
          )}

          {activeTab === 'settings' && projectId !== 'general' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <ProjectSettings
                  project={project}
                  onProjectUpdate={async () => {
                    // Refresh project data
                    try {
                      const response = await fetch(`/api/projects/${projectId}`);
                      if (response.ok) {
                        const data = await response.json();
                        setProject(data);
                      }
                    } catch (error) {
                      console.error('Error refreshing project:', error);
                    }
                  }}
                />
              </div>

              {/* Danger Zone */}
              <div className="bg-white rounded-xl border border-red-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Danger Zone</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Irreversible actions like archiving or deleting this project space. Consider archiving instead of deleting to preserve data.
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleProjectArchive(project)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors"
                      >
                        <Archive className="w-4 h-4" />
                        Archive Project
                      </button>
                      <button
                        onClick={() => handleProjectDeleteClick(project)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Project
                      </button>
                    </div>
                  </div>
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
            <p className="text-sm text-gray-500 mb-4">&quot;{lockModal.file?.name}&quot;</p>

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

      {/* Move File Modal */}
      {moveModal.show && (
        <MoveModal
          isOpen={moveModal.show}
          file={moveModal.file}
          currentProjectId={projectId}
          currentFolderId={currentFolderId}
          onClose={() => setMoveModal({ show: false, file: null })}
          onMove={handleFileMove}
        />
      )}

      {/* Document Viewer Modal */}
      {viewingFile && (
        <DocumentViewer
          file={viewingFile}
          onClose={() => setViewingFile(null)}
        />
      )}

      {/* Create File Modal */}
      <CreateFileModal
        isOpen={showCreateFileModal}
        onClose={() => setShowCreateFileModal(false)}
        onCreate={handleCreateFile}
        defaultProjectId={projectId}
        defaultFolderId={currentFolderId}
        userProjects={[]}
      />

      {/* File Editor Modal */}
      {editingFile && (
        (editingFile.fileType === 'md' || editingFile.mimeType === 'text/markdown') ? (
          <MarkdownViewer
            file={editingFile}
            onClose={() => setEditingFile(null)}
            canEdit={true}
            onSaved={handleFileSave}
          />
        ) : (
          <FileEditor
            file={editingFile}
            onClose={() => setEditingFile(null)}
            canEdit={true}
            onSaved={handleFileSave}
          />
        )
      )}

      {/* Share Modal */}
      {sharingFile && (
        <ShareModal
          isOpen={!!sharingFile}
          onClose={() => setSharingFile(null)}
          file={sharingFile}
          projectId={projectId}
        />
      )}

      {/* Share Links Management Modal */}
      <ShareLinksModal
        isOpen={showShareLinksModal}
        onClose={() => setShowShareLinksModal(false)}
        projectId={projectId}
      />

      {/* Folder Delete Confirmation Modal */}
      {folderDeleteConfirm.show && folderDeleteConfirm.folder && (
        <FolderDeleteConfirmModal
          folder={folderDeleteConfirm.folder}
          onClose={() => setFolderDeleteConfirm({ show: false, folder: null })}
          onConfirm={handleFolderDelete}
          onMassMove={handleFolderMassMove}
        />
      )}

      {/* File Delete Confirmation Modal */}
      {fileDeleteConfirm.show && fileDeleteConfirm.file && (
        <FileDeleteConfirmModal
          file={fileDeleteConfirm.file}
          onClose={() => setFileDeleteConfirm({ show: false, file: null })}
          onConfirm={handleFileDeleteConfirm}
        />
      )}

      {/* Project Delete Confirmation Modal */}
      {projectDeleteConfirm.show && projectDeleteConfirm.project && (
        <ProjectDeleteConfirmModal
          project={projectDeleteConfirm.project}
          onClose={() => setProjectDeleteConfirm({ show: false, project: null })}
          onConfirm={handleProjectDelete}
          onMassMove={handleProjectMassMove}
          onArchive={handleProjectArchive}
        />
      )}

      {/* Mass Move Modal */}
      {massMoveModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setMassMoveModal({ show: false, items: [], stats: null })}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Move Contents</h3>
            <p className="text-sm text-gray-600 mb-4">
              Mass move functionality coming soon. This will allow you to move {massMoveModal.stats?.totalFiles || 0} files and {massMoveModal.stats?.totalFolders || 0} folders to another project or folder.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setMassMoveModal({ show: false, items: [], stats: null })}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
