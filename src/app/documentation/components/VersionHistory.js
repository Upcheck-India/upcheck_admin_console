'use client';

import React, { useState, useEffect } from 'react';
import { 
  GitBranch, Clock, User, Download, RotateCcw, Check, 
  FileText, AlertCircle, X
} from 'lucide-react';

export default function VersionHistory({ 
  resourceId, 
  resourceName,
  isOpen, 
  onClose,
  onRevert,
  onDownloadVersion 
}) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && resourceId) {
      fetchVersions();
    }
  }, [isOpen, resourceId]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/documentation/versions?resourceId=${resourceId}`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data);
      } else {
        setError('Failed to load version history');
      }
    } catch (error) {
      console.error('Error fetching versions:', error);
      setError('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async (versionId, versionNumber) => {
    if (!confirm(`Are you sure you want to revert to version ${versionNumber}? This will create a new version.`)) {
      return;
    }

    try {
      setReverting(versionId);
      const response = await fetch('/api/documentation/versions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId, versionId })
      });

      if (response.ok) {
        await fetchVersions();
        if (onRevert) onRevert();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to revert');
      }
    } catch (error) {
      console.error('Error reverting:', error);
      setError('Failed to revert version');
    } finally {
      setReverting(null);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Version History</h2>
              <p className="text-sm text-gray-500 truncate max-w-md">{resourceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-start gap-4 p-4 border border-gray-100 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gray-200"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
              <p className="text-red-600">{error}</p>
              <button
                onClick={fetchVersions}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700"
              >
                Try again
              </button>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12">
              <GitBranch className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No version history available</p>
              <p className="text-sm text-gray-400 mt-1">
                Version history will appear when you upload new versions of this file.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version, index) => (
                <div
                  key={version._id}
                  className={`relative p-4 rounded-lg border transition-colors ${
                    version.isCurrent 
                      ? 'border-teal-200 bg-teal-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Version indicator line */}
                  {index < versions.length - 1 && (
                    <div className="absolute left-7 top-14 bottom-0 w-px bg-gray-200 -mb-3"></div>
                  )}

                  <div className="flex items-start gap-4">
                    {/* Version number badge */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      version.isCurrent 
                        ? 'bg-teal-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      v{version.versionNumber}
                    </div>

                    {/* Version info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">
                          {version.changeNote || `Version ${version.versionNumber}`}
                        </span>
                        {version.isCurrent && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
                            <Check className="w-3 h-3 mr-1" />
                            Current
                          </span>
                        )}
                        {version.revertedFrom && (
                          <span className="text-xs text-orange-600">
                            (reverted from v{version.revertedFrom})
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {version.createdBy?.username || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(version.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {formatFileSize(version.fileSize)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => onDownloadVersion(version)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-blue-600 transition-colors"
                        title="Download this version"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {!version.isCurrent && (
                        <button
                          onClick={() => handleRevert(version._id, version.versionNumber)}
                          disabled={reverting === version._id}
                          className="p-2 rounded-lg hover:bg-orange-50 text-gray-600 hover:text-orange-600 transition-colors disabled:opacity-50"
                          title="Revert to this version"
                        >
                          {reverting === version._id ? (
                            <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <p className="text-xs text-gray-500">
            Version history tracks changes to this file. You can download previous versions or revert to restore an earlier version.
          </p>
        </div>
      </div>
    </div>
  );
}
