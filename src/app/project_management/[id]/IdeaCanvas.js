'use client';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, Save, Pencil, RefreshCw, Clock, AlertCircle, CheckCircle2, X, HelpCircle } from 'lucide-react';
import CanvasHelpModal from './CanvasHelpModal';
import { useAuth } from '../../../hooks/useAuth';

const IdeaCanvas = ({ project }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  
  const textareaRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const lastSavedContentRef = useRef('');

  const canEdit = React.useMemo(() => {
    if (!user || !project) return false;
    const isSuperManager = project.superManager === user.username;
    const isProjectManager = project.members?.some(m => m.user === user.username && m.role === 'Project Manager');
    return isSuperManager || isProjectManager;
  }, [project, user]);

  const canView = React.useMemo(() => {
    if (!user || !project) return false;
    const isSuperManager = project.superManager === user.username;
    const isMember = project.members?.some(m => m.user === user.username);
    return isSuperManager || isMember;
  }, [project, user]);

  // Auto-save functionality
  const autoSave = useCallback(async (contentToSave) => {
    if (!canEdit || !project?._id || contentToSave === lastSavedContentRef.current) return;
    
    setAutoSaving(true);
    try {
      const res = await fetch(`/api/projects/${project._id}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentToSave }),
      });
      
      if (res.ok) {
        lastSavedContentRef.current = contentToSave;
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setAutoSaving(false);
    }
  }, [canEdit, project]);

  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);
    setHasUnsavedChanges(newContent !== originalContent);
    
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save (3 seconds after user stops typing)
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSave(newContent);
    }, 3000);
  }, [originalContent, autoSave]);

  const fetchCanvas = useCallback(async () => {
    if (!project?._id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project._id}/canvas`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch canvas');
      }
      const data = await res.json();
      const fetchedContent = data.content || '';
      setContent(fetchedContent);
      setOriginalContent(fetchedContent);
      lastSavedContentRef.current = fetchedContent;
      setHasUnsavedChanges(false);
      setLastSaved(data.updatedAt ? new Date(data.updatedAt) : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [project]);

  const saveCanvas = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project._id}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save canvas');
      }
      setOriginalContent(content);
      lastSavedContentRef.current = content;
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      setEditing(false);
      setSuccessMessage('Canvas saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [project, content]);

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirm) return;
    }
    setContent(originalContent);
    setHasUnsavedChanges(false);
    setEditing(false);
    setError(null);
  }, [hasUnsavedChanges, originalContent]);

  useEffect(() => {
    fetchCanvas();
  }, [fetchCanvas]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      // Set cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const formatLastSaved = (date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (editing && (e.ctrlKey || e.metaKey)) {
        if (e.key === 's') {
          e.preventDefault();
          saveCanvas();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editing, saveCanvas, handleCancel]);

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-center">
          <AlertCircle className="h-5 w-5 text-yellow-600 mx-auto mb-2" />
          <p className="text-yellow-800">You don't have permission to view this canvas.</p>
          <p className="text-blue-800">If you believe that this could be a bug try waiting for some time, reload the page or report to an administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-bold text-gray-900">Super Canvas</h2>
                <button
                  onClick={() => setHelpOpen(true)}
                  className="text-gray-400 hover:text-gray-600"
                  title="What's this?"
                >
                  <HelpCircle className="h-5 w-5" />
                </button>
              </div>
            {lastSaved && (
              <div className="flex items-center text-sm text-gray-500 mt-1">
                <Clock className="h-4 w-4 mr-1" />
                Last saved: {formatLastSaved(lastSaved)}
                {autoSaving && <span className="ml-2 text-blue-500">(Auto-saving on cloud...)</span>}
                {hasUnsavedChanges && !autoSaving && (
                  <span className="ml-2 text-orange-500">(Unsaved changes)</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center bg-blue-600 text-white text-sm px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
              >
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={saveCanvas}
                  disabled={saving}
                  className="flex items-center bg-green-600 text-white text-sm px-3 py-1.5 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex items-center bg-gray-200 text-gray-700 text-sm px-3 py-1.5 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors"
                >
                  <X className="h-4 w-4 mr-1" /> Cancel
                </button>
              </>
            )}
            <button
              onClick={fetchCanvas}
              className="flex items-center bg-gray-100 text-gray-600 text-sm px-2 py-1.5 rounded-md hover:bg-gray-200 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm flex items-center">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-md text-sm flex items-center">
            <CheckCircle2 className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="ml-auto text-green-500 hover:text-green-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Editor / Viewer */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => handleContentChange(e.target.value)}
              className="w-full min-h-[500px] border border-gray-300 rounded-md p-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y transition-colors"
              placeholder="Write your ideas, plans and notes here..."
              spellCheck={true}
            />
            <div className="text-xs text-gray-500 flex justify-between items-center">
              <span>
                {content.length} characters | {content.split('\n').length} lines
              </span>
              <span className="text-gray-400">
                Tip: Use Ctrl+S to save, Esc to cancel
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-md min-h-[500px] group">
            <div className="p-4 prose max-w-none whitespace-pre-wrap">
              {content || (
                <div className="text-center py-16">
                  <div className="text-gray-400 text-lg mb-2">📝</div>
                  <p className="text-gray-500 italic">
                    Nothing yet. {canEdit ? 'Click Edit to start writing.' : 'Ask a project manager to add content.'}
                  </p>
                </div>
              )}
            </div>
            {canEdit && content && (
              <div className="border-t border-gray-100 p-2 bg-gray-50 rounded-b-md opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-gray-600 hover:text-gray-800 flex items-center"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Click to edit
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <CanvasHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
};

export default IdeaCanvas;