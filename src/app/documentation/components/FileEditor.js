'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Save, Edit2, Eye, AlertCircle, CheckCircle2, Loader2,
  FileText, FileCode, ChevronLeft
} from 'lucide-react';

export default function FileEditor({ file, onClose, canEdit = false, onSaved }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [fileType, setFileType] = useState('txt');
  const [version, setVersion] = useState(1);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [originalContent, setOriginalContent] = useState('');

  const textareaRef = useRef(null);

  // Determine file type from file object
  useEffect(() => {
    if (file) {
      const type = file.fileType ||
                   (file.mimeType === 'text/plain' ? 'txt' : 'docx');
      setFileType(type);
    }
  }, [file]);

  // Fetch file content on open
  useEffect(() => {
    if (file?._id) {
      fetchFileContent(file._id);
    }
  }, [file?._id]);

  // Fetch file content
  const fetchFileContent = async (fileId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/documentation/files/${fileId}`);
      const data = await response.json();

      if (response.ok) {
        let content = data.content || '';

        // For DOCX files, content comes as base64 - we need to decode it
        if (data.fileType === 'docx' || data.contentType?.includes('wordprocessingml')) {
          try {
            // Decode base64 to text
            const decoded = atob(content);
            // Extract text from HTML content (simple approach)
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = decoded;
            content = tempDiv.textContent || tempDiv.innerText || decoded;
          } catch (e) {
            console.error('Error decoding DOCX content:', e);
            // Keep base64 as fallback with error message
            content = '[Unable to decode DOCX content. Please download to view.]';
          }
        }

        setContent(content);
        setOriginalContent(content);
        setVersion(data.version || 1);
        setFileType(data.fileType || 'txt');
        setEditing(false);
      } else {
        setError(data.error || 'Failed to load file content');
      }
    } catch (err) {
      setError('An error occurred while loading the file.');
    } finally {
      setLoading(false);
    }
  };
  // Warn about unsaved changes
  useEffect(() => {
    const hasUnsavedChanges = content !== originalContent && editing;
    setShowUnsavedWarning(hasUnsavedChanges);

    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [content, originalContent, editing]);

  const handleSave = async () => {
    if (!canEdit) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/documentation/files/${file._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content,
          version: version
        })
      });

      const result = await response.json();

      if (response.ok) {
        setVersion(result.version);
        setOriginalContent(content);
        setEditing(false);
        onSaved?.(result);
      } else {
        setError(result.error || 'Failed to save changes');
      }
    } catch (err) {
      setError('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    setContent(originalContent);
    setEditing(false);
    setError(null);
  };

  const getPlaceholder = () => {
    if (fileType === 'txt') {
      return 'Enter your text content here...';
    }
    return 'Enter your document content here...';
  };

  if (!file) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="animate-modal-in bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (showUnsavedWarning) {
                  if (confirm('You have unsaved changes. Discard them?')) {
                    handleDiscardChanges();
                  }
                } else {
                  onClose();
                }
              }}
              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              {fileType === 'txt' ? (
                <FileText className="w-5 h-5 text-blue-500" />
              ) : (
                <FileCode className="w-5 h-5 text-blue-500" />
              )}
              <span className="font-semibold text-gray-900 truncate max-w-[300px]">
                {file.name}
              </span>
              <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                v{version}
              </span>
              {showUnsavedWarning && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Unsaved changes
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={handleDiscardChanges}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || content === originalContent}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    content === originalContent
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } disabled:opacity-50`}
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  ) : (
                    <><Save className="w-4 h-4" /> Save</>
                  )}
                </button>
              </>
            )}
            {!canEdit && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg">
                <Eye className="w-3.5 h-3.5" />
                View Only
              </span>
            )}
            <button
              onClick={() => {
                if (showUnsavedWarning) {
                  if (confirm('You have unsaved changes. Discard them?')) {
                    onClose();
                  }
                } else {
                  onClose();
                }
              }}
              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-gray-900">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-gray-400 text-sm">Loading file content…</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-red-400">
                <AlertCircle className="w-8 h-8" />
                <p className="text-sm">{error}</p>
                <button
                  onClick={() => fetchFileContent(file._id)}
                  className="px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto p-6">
              {editing ? (
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={getPlaceholder()}
                  className={`w-full h-full bg-gray-800 text-gray-100 p-4 rounded-xl outline-none resize-none font-mono text-sm ${
                    fileType === 'txt' ? 'font-mono' : ''
                  }`}
                  style={{ minHeight: '400px' }}
                  autoFocus
                />
              ) : (
                <pre className="whitespace-pre-wrap break-words font-mono text-sm text-gray-100">
                  {content || <span className="text-gray-500 italic">Empty file</span>}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              {fileType === 'txt' ? (
                <FileText className="w-3.5 h-3.5" />
              ) : (
                <FileCode className="w-3.5 h-3.5" />
              )}
              {fileType === 'txt' ? 'Plain Text' : 'Word Document'}
            </span>
            <span>•</span>
            <span>{content.length} characters</span>
            <span>•</span>
            <span>{content.split(/\s+/).filter(w => w).length} words</span>
          </div>
          {canEdit && editing && (
            <div className="text-xs text-amber-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Editing mode - click Save to apply changes
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
