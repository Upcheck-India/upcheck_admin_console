'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Download,
  Eye,
  Lock,
  Unlock,
  Edit,
  Trash2,
  Clock,
  User,
  FileText,
  MessageSquare,
  History,
  Share2,
  Tag,
  Users,
  Shield
} from 'lucide-react';
import ShareDialog from './ShareDialog';
import PermissionManager from './PermissionManager';
import DocumentActivitySummary from './DocumentActivitySummary';

export default function DocumentDetailPanel({ document, onClose }) {
  const [activeTab, setActiveTab] = useState('details');
  const [versions, setVersions] = useState([]);
  const [comments, setComments] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showPermissionManager, setShowPermissionManager] = useState(false);

  useEffect(() => {
    if (document) {
      fetchVersions();
      fetchComments();
      fetchPermissions();
    }
  }, [document]);

  async function fetchVersions() {
    try {
      const response = await fetch(`/api/dataroom/documents/${document._id}/versions`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    }
  }

  async function fetchComments() {
    try {
      const response = await fetch(`/api/dataroom/documents/${document._id}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  }

  async function fetchPermissions() {
    try {
      const response = await fetch(`/api/dataroom/permissions?resourceType=document&resourceId=${document._id}`);
      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions || []);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  }

  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('view');
  const [isSharing, setIsSharing] = useState(false);

  async function handleShare(e) {
    e.preventDefault();
    if (!shareEmail) return;

    setIsSharing(true);
    try {
      const response = await fetch('/api/dataroom/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType: 'document',
          resourceId: document._id,
          roomId: document.roomId,
          userEmail: shareEmail,
          permissions: [sharePermission],
        }),
      });

      if (response.ok) {
        setShareEmail('');
        fetchPermissions();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to share document');
      }
    } catch (error) {
      console.error('Failed to share:', error);
    } finally {
      setIsSharing(false);
    }
  }

  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  async function handleAddComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const response = await fetch(`/api/dataroom/documents/${document._id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      });

      if (response.ok) {
        setNewComment('');
        fetchComments();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  }

  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [versionNote, setVersionNote] = useState('');
  const [versionFile, setVersionFile] = useState(null);

  async function handleUploadVersion(e) {
    e.preventDefault();
    if (!versionFile) return;

    setUploadingVersion(true);
    const formData = new FormData();
    formData.append('file', versionFile);
    formData.append('changeNote', versionNote);
    formData.append('isMajor', 'false');

    try {
      const response = await fetch(`/api/dataroom/documents/${document._id}/versions`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setVersionFile(null);
        setVersionNote('');
        fetchVersions();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to upload version');
      }
    } catch (error) {
      console.error('Failed to upload version:', error);
    } finally {
      setUploadingVersion(false);
    }
  }

  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  function formatDate(date) {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  const tabs = [
    { id: 'details', label: 'Details', icon: FileText },
    { id: 'versions', label: 'Versions', icon: History },
    { id: 'comments', label: 'Comments', icon: MessageSquare },
    { id: 'permissions', label: 'Permissions', icon: Share2 },
  ];

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-xl z-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold truncate">{document.name}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-blue-100">{document.fileName}</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center space-x-1 border-b-2 transition-colors ${activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2">
                <Eye className="w-4 h-4" />
                <span>View</span>
              </button>
              <button className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 flex items-center justify-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            </div>

            {/* Document Info */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-200">
                <span className="text-sm text-slate-600">File Size</span>
                <span className="text-sm font-medium text-slate-900">{formatFileSize(document.fileSize)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-200">
                <span className="text-sm text-slate-600">Version</span>
                <span className="text-sm font-medium text-slate-900">v{document.version}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-200">
                <span className="text-sm text-slate-600">State</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${document.state === 'published' ? 'bg-green-100 text-green-800' :
                  document.state === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                  {document.state}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-200">
                <span className="text-sm text-slate-600">Created</span>
                <span className="text-sm font-medium text-slate-900">{formatDate(document.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-200">
                <span className="text-sm text-slate-600">Modified</span>
                <span className="text-sm font-medium text-slate-900">{formatDate(document.updatedAt)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-200">
                <span className="text-sm text-slate-600">Created By</span>
                <span className="text-sm font-medium text-slate-900">{document.createdBy?.email || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-600">Locked</span>
                <span className="text-sm font-medium text-slate-900">
                  {document.isLocked ? (
                    <Lock className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Unlock className="w-4 h-4 text-green-600" />
                  )}
                </span>
              </div>
            </div>

            {/* Tags */}
            {document.tags && document.tags.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Tag className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {document.tags.map((tag, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Summary */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Activity Summary</h4>
              <DocumentActivitySummary documentId={document._id} />
            </div>
          </div>
        )}

        {activeTab === 'versions' && (
          <div className="space-y-4">
            {/* Upload New Version Form */}
            <form onSubmit={handleUploadVersion} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
              <h4 className="text-sm font-medium text-slate-900">Upload New Version</h4>
              <input
                type="file"
                onChange={(e) => setVersionFile(e.target.files[0])}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={uploadingVersion}
                required
              />
              <input
                type="text"
                value={versionNote}
                onChange={(e) => setVersionNote(e.target.value)}
                placeholder="Version note (optional)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={uploadingVersion}
              />
              <button
                type="submit"
                disabled={uploadingVersion || !versionFile}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                {uploadingVersion ? 'Uploading...' : 'Upload Version'}
              </button>
            </form>

            {/* Version History List */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-900">Version History</h4>
              {versions.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No version history</p>
              ) : (
                versions.map((version) => (
                  <div key={version._id} className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-900">Version {version.versionNumber}</span>
                      <span className="text-xs text-slate-500">{formatDate(version.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">{version.changeNote || 'No description'}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{formatFileSize(version.fileSize)}</span>
                      <span>{version.createdBy?.email}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No comments yet</p>
            ) : (
              comments.map((comment) => (
                <div key={comment._id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2 mb-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-900">{comment.author?.name}</span>
                        <span className="text-xs text-slate-500">{formatDate(comment.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{comment.text}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
            <form onSubmit={handleAddComment} className="mt-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                disabled={isSubmittingComment}
                required
              ></textarea>
              <button
                type="submit"
                disabled={isSubmittingComment || !newComment.trim()}
                className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingComment ? 'Adding...' : 'Add Comment'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowShareDialog(true)}
                className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center space-x-2 shadow-lg"
              >
                <Share2 className="w-4 h-4" />
                <span className="font-medium">Create Link</span>
              </button>
              <button
                onClick={() => setShowPermissionManager(true)}
                className="px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 flex items-center justify-center space-x-2 shadow-lg"
              >
                <Shield className="w-4 h-4" />
                <span className="font-medium">Manage Access</span>
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-900">Current Access</h4>
              {permissions.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                  No specific permissions set
                </p>
              ) : (
                permissions.map((perm) => (
                  <div key={perm._id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        {perm.groupId ? <Users className="w-4 h-4 text-blue-600" /> : <User className="w-4 h-4 text-blue-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {perm.userEmail || perm.userId || perm.groupId || 'Unknown'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {perm.groupId ? 'Group' : 'User'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full border border-slate-200">
                        {perm.permissions?.join(', ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showShareDialog && (
        <ShareDialog
          resourceType="document"
          resourceId={document._id}
          resourceName={document.name}
          onClose={() => setShowShareDialog(false)}
        />
      )}

      {showPermissionManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Shield className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">Manage Permissions</h2>
              </div>
              <button
                onClick={() => {
                  setShowPermissionManager(false);
                  fetchPermissions();
                }}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[calc(90vh-80px)] overflow-y-auto">
              <PermissionManager
                resourceType="document"
                resourceId={document._id}
                roomId={document.roomId}
                onClose={() => {
                  setShowPermissionManager(false);
                  fetchPermissions();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
