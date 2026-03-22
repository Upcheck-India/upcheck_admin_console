'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch, Clock, User, Download, RotateCcw, Check,
  FileText, AlertCircle, X, ChevronDown, History
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins  < 1)   return 'Just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateFull(date) {
  return new Date(date).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatBytes(bytes) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── VersionRow ───────────────────────────────────────────────────────────────

function VersionRow({ version, isFirst, isLast, onRevert, onDownload, reverting }) {
  const [expanded, setExpanded] = useState(false);
  const isReverting = reverting === version._id;

  return (
    <div className={`relative ${!isLast ? 'pb-2' : ''}`}>
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-px bg-gray-100" />
      )}

      <div className={`relative flex gap-4 p-4 rounded-2xl border transition-all ${
        version.isCurrent
          ? 'border-teal-200 bg-teal-50/60 shadow-sm'
          : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
      }`}>

        {/* Version badge */}
        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold z-10 ring-2 ring-white ${
          version.isCurrent
            ? 'bg-teal-500 text-white ring-teal-100'
            : 'bg-gray-100 text-gray-500'
        }`}>
          v{version.versionNumber}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">
                {version.changeNote || `Version ${version.versionNumber}`}
              </span>
              {version.isCurrent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-100 text-teal-700 ring-1 ring-teal-200">
                  <Check className="w-2.5 h-2.5" /> Current
                </span>
              )}
              {version.revertedFrom && (
                <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full ring-1 ring-amber-200">
                  reverted from v{version.revertedFrom}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onDownload(version)}
                title="Download this version"
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {!version.isCurrent && (
                <button
                  onClick={() => onRevert(version._id, version.versionNumber)}
                  disabled={isReverting}
                  title="Revert to this version"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  {isReverting
                    ? <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    : <RotateCcw className="w-3.5 h-3.5" />
                  }
                </button>
              )}

              <button
                onClick={() => setExpanded(v => !v)}
                className={`p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all ${expanded ? 'rotate-180' : ''}`}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {version.createdBy?.username || 'Unknown'}
            </span>
            <span title={formatDateFull(version.createdAt)} className="flex items-center gap-1 cursor-default">
              <Clock className="w-3 h-3" />
              {formatDate(version.createdAt)}
            </span>
            {formatBytes(version.fileSize) && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {formatBytes(version.fileSize)}
              </span>
            )}
          </div>

          {/* Expanded details */}
          {expanded && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1.5">
              <div className="flex gap-2">
                <span className="text-gray-400 w-20 shrink-0">Full date</span>
                <span className="text-gray-700 font-medium">{formatDateFull(version.createdAt)}</span>
              </div>
              {version.createdBy?.email && (
                <div className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">Author</span>
                  <span className="text-gray-700 font-medium">{version.createdBy.email}</span>
                </div>
              )}
              {version.fileSize && (
                <div className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">Size</span>
                  <span className="text-gray-700 font-medium">{formatBytes(version.fileSize)}</span>
                </div>
              )}
              {version._id && (
                <div className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">ID</span>
                  <span className="text-gray-700 font-mono text-[11px] break-all">{version._id}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── VersionHistory ───────────────────────────────────────────────────────────

export default function VersionHistory({
  resourceId,
  resourceName,
  isOpen,
  onClose,
  onRevert,
  onDownloadVersion,
}) {
  const [versions, setVersions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [reverting, setReverting] = useState(null);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (isOpen && resourceId) fetchVersions();
  }, [isOpen, resourceId]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/documentation/versions?resourceId=${resourceId}`);
      if (res.ok) setVersions(await res.json());
      else setError('Failed to load version history.');
    } catch {
      setError('Failed to load version history.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async (versionId, versionNumber) => {
    if (!confirm(`Revert to version ${versionNumber}? A new version will be created.`)) return;
    try {
      setReverting(versionId);
      const res = await fetch('/api/documentation/versions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId, versionId }),
      });
      if (res.ok) {
        await fetchVersions();
        if (onRevert) onRevert();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to revert.');
      }
    } catch {
      setError('Failed to revert version.');
    } finally {
      setReverting(null);
    }
  };

  if (!isOpen) return null;

  const currentVersion = versions.find(v => v.isCurrent);

  return (
    <>
      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: translateY(10px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .modal-enter { animation: modal-in 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>

      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="modal-enter bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                <History className="w-5 h-5 text-teal-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-gray-900">Version History</h2>
                <p className="text-xs text-gray-400 truncate mt-0.5 max-w-xs">{resourceName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!loading && versions.length > 0 && (
                <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 mr-1">
                  <span className="font-medium text-gray-600">{versions.length}</span> version{versions.length !== 1 ? 's' : ''}
                  {currentVersion && (
                    <>
                      <span>·</span>
                      <span>Latest: <span className="font-medium text-teal-600">v{currentVersion.versionNumber}</span></span>
                    </>
                  )}
                </div>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm">{error}</p>
                  <button onClick={fetchVersions} className="text-xs text-red-600 hover:text-red-800 underline mt-1">
                    Try again
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl border border-gray-100 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0" />
                    <div className="flex-1 space-y-2.5 py-0.5">
                      <div className="flex gap-2">
                        <div className="h-3.5 bg-gray-100 rounded-md w-24" />
                        <div className="h-3.5 bg-gray-100 rounded-full w-14" />
                      </div>
                      <div className="h-3 bg-gray-100 rounded-md w-48" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!loading && !error && versions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
                  <GitBranch className="w-6 h-6 text-gray-300" />
                </div>
                <h3 className="text-sm font-semibold text-gray-700">No version history yet</h3>
                <p className="text-xs text-gray-400 mt-1.5 max-w-xs">
                  Version history is created automatically when you upload new versions of this file.
                </p>
              </div>
            )}

            {/* Versions list */}
            {!loading && versions.length > 0 && (
              <div className="space-y-2">
                {versions.map((version, index) => (
                  <VersionRow
                    key={version._id}
                    version={version}
                    isFirst={index === 0}
                    isLast={index === versions.length - 1}
                    onRevert={handleRevert}
                    onDownload={onDownloadVersion}
                    reverting={reverting}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/70 rounded-b-2xl shrink-0">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Download any version or revert to restore it as the current file. Reverts create a new version entry.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}