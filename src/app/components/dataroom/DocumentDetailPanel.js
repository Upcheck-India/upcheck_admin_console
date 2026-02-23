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
  Tag
} from 'lucide-react';

export default function DocumentDetailPanel({ document, onClose }) {
  const [activeTab, setActiveTab] = useState('details');
  const [versions, setVersions] = useState([]);
  const [comments, setComments] = useState([]);
  const [permissions, setPermissions] = useState([]);

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
      const response = await fetch(`/api/dataroom/permissions?targetType=document&targetId=${document._id}`);
      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions || []);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
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
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center space-x-1 border-b-2 transition-colors ${
                activeTab === tab.id
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
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  document.state === 'published' ? 'bg-green-100 text-green-800' :
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

            {/* Statistics */}
            <div className="bg-slate-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Activity</h4>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Views</span>
                  <span className="font-medium text-slate-900">{document.viewCount || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Downloads</span>
                  <span className="font-medium text-slate-900">{document.downloadCount || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Prints</span>
                  <span className="font-medium text-slate-900">{document.printCount || 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'versions' && (
          <div className="space-y-3">
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
            <textarea
              placeholder="Add a comment..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="3"
            ></textarea>
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Add Comment
            </button>
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="space-y-3">
            {permissions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No specific permissions set</p>
            ) : (
              permissions.map((perm) => (
                <div key={perm._id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {perm.granteeType === 'user' ? '👤 User' : '👥 Group'}
                      </p>
                      <p className="text-xs text-slate-600">{perm.granteeId}</p>
                    </div>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {perm.permissionLevel}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
