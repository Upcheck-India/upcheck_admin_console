'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Save, Edit2, Eye, AlertCircle, CheckCircle2, Loader2,
  FileText, ChevronLeft, Undo, Redo, Bold, Italic, Heading,
  List, ListOrdered, Link as LinkIcon, Quote, Code, Minimize, Maximize, Download
} from 'lucide-react';
import DOMPurify from 'dompurify';

// Lazy load marked for markdown parsing
let marked = null;
const loadMarked = async () => {
  if (!marked) {
    const markedModule = await import('marked');
    marked = markedModule.marked;
  }
  return marked;
};

// Sanitize HTML to prevent XSS
const sanitizeHtml = (html) => {
  if (typeof window !== 'undefined') {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'div', 'span', 'sup', 'sub'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'class', 'id'],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
    });
  }
  return html;
};

export default function MarkdownViewer({ file, onClose, canEdit = false, onSaved }) {
  const [content, setContent] = useState('');
  const [renderedHtml, setRenderedHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(1);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [originalContent, setOriginalContent] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [viewMode, setViewMode] = useState('split'); // 'split', 'preview', 'edit'
  const [isFullscreen, setIsFullscreen] = useState(false);

  const textareaRef = useRef(null);
  const previewRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Sync scroll between editor and preview
  const handleScroll = useCallback((e) => {
    if (viewMode !== 'split' || !editing) return;
    const textarea = e.target;
    const preview = previewRef.current;
    if (preview) {
      const percentage = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight);
      preview.scrollTop = percentage * (preview.scrollHeight - preview.clientHeight);
    }
  }, [viewMode, editing]);

  // Fetch file content on open
  useEffect(() => {
    if (file?._id) {
      fetchFileContent(file._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?._id]);

  // Render markdown in real-time when content changes (including during editing)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      renderMarkdown(content);
    }, 50); // Small debounce for performance
    return () => clearTimeout(timeoutId);
  }, [content]);

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

  // Auto-save debounce
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (editing && content !== originalContent && canEdit) {
      saveTimeoutRef.current = setTimeout(() => {
        handleSave(true); // Auto-save
      }, 3000); // Auto-save after 3 seconds of no changes
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content]);

  const fetchFileContent = async (fileId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/documentation/files/${fileId}`);
      const data = await response.json();

      if (response.ok) {
        let fileContent = data.content || '';

        // For markdown files, content comes as plain text
        if (data.fileType === 'md' || data.mimeType === 'text/markdown') {
          setContent(fileContent);
          setOriginalContent(fileContent);
          setVersion(data.version || 1);
          setEditing(false);
          addToHistory(fileContent);
        } else {
          setContent(fileContent);
          setOriginalContent(fileContent);
          setVersion(data.version || 1);
          setEditing(false);
          addToHistory(fileContent);
        }
      } else {
        setError(data.error || 'Failed to load file content');
      }
    } catch (err) {
      setError('An error occurred while loading the file.');
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = async (text) => {
    if (!text) {
      setRenderedHtml('');
      return;
    }

    setRendering(true);
    try {
      const parser = await loadMarked();
      const html = parser(text, {
        breaks: true,
        gfm: true,
        headerIds: true,
        mangle: false,
        highlight: (code, lang) => {
          return code; // Could integrate with a syntax highlighter
        }
      });
      setRenderedHtml(sanitizeHtml(html));
    } catch (e) {
      console.error('Markdown parsing error:', e);
      // Fallback: simple parsing
      setRenderedHtml(sanitizeHtml(simpleMarkdownParse(text)));
    } finally {
      setRendering(false);
    }
  };

  // Simple markdown parser as fallback
  const simpleMarkdownParse = (text) => {
    return text
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\`(.*)\`/gim, '<code class="inline-code">$1</code>')
      .replace(/\`\`\`([\s\S]*?)\`\`\`/gim, '<pre class="code-block"><code>$1</code></pre>')
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/gim, '<br>');
  };

  const addToHistory = (newContent) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newContent);
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setContent(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setContent(history[newIndex]);
    }
  };

  const insertText = (before, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newContent = content.substring(0, start) + before + selectedText + after + content.substring(end);

    setContent(newContent);
    addToHistory(newContent);

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const handleSave = async (isAutoSave = false) => {
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
        if (!isAutoSave) {
          setEditing(false);
        }
        onSaved?.(result);

        if (isAutoSave) {
          // Show brief success notification
          const notification = document.createElement('div');
          notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in';
          notification.textContent = 'Auto-saved';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 2000);
        }
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
    setHistory([originalContent]);
    setHistoryIndex(0);
  };

  const handleStartEditing = () => {
    setEditing(true);
    setViewMode('edit');
    addToHistory(content);
  };

  const wordCount = content.split(/\s+/).filter(w => w).length;
  const charCount = content.length;
  const lineCount = content.split('\n').length;
  const readingTime = Math.ceil(wordCount / 200); // ~200 words per minute

  return (
    <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isFullscreen ? 'p-0' : ''}`}>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }

        .markdown-preview {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          line-height: 1.7;
          color: #1f2937;
        }
        .markdown-preview h1 { font-size: 2em; font-weight: 700; margin: 1.5em 0 0.5em; color: #111827; }
        .markdown-preview h2 { font-size: 1.5em; font-weight: 600; margin: 1.5em 0 0.5em; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
        .markdown-preview h3 { font-size: 1.25em; font-weight: 600; margin: 1.2em 0 0.5em; color: #374151; }
        .markdown-preview h4 { font-size: 1em; font-weight: 600; margin: 1em 0 0.5em; }
        .markdown-preview p { margin: 1em 0; }
        .markdown-preview blockquote {
          border-left: 4px solid #3b82f6;
          padding-left: 1em;
          margin: 1em 0;
          color: #6b7280;
          font-style: italic;
          background: #f9fafb;
          padding: 0.75em 1em;
          border-radius: 0 0.5em 0.5em 0;
        }
        .markdown-preview ul, .markdown-preview ol { margin: 1em 0; padding-left: 2em; }
        .markdown-preview li { margin: 0.5em 0; }
        .markdown-preview code {
          background: #f3f4f6;
          padding: 0.2em 0.4em;
          border-radius: 0.25em;
          font-family: 'SF Mono', Monaco, Consolas, monospace;
          font-size: 0.9em;
          color: #dc2626;
        }
        .markdown-preview pre {
          background: #1f2937;
          color: #f9fafb;
          padding: 1em;
          border-radius: 0.5em;
          overflow-x: auto;
          margin: 1em 0;
        }
        .markdown-preview pre code {
          background: transparent;
          color: inherit;
          padding: 0;
        }
        .markdown-preview a {
          color: #2563eb;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .markdown-preview a:hover { color: #1d4ed8; }
        .markdown-preview table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        .markdown-preview th, .markdown-preview td {
          border: 1px solid #e5e7eb;
          padding: 0.75em;
          text-align: left;
        }
        .markdown-preview th { background: #f9fafb; font-weight: 600; }
        .markdown-preview tr:nth-child(even) { background: #f9fafb; }
        .markdown-preview img { max-width: 100%; height: auto; margin: 1em 0; border-radius: 0.5em; }
        .markdown-preview hr { border: none; border-top: 2px solid #e5e7eb; margin: 2em 0; }
        .markdown-preview .task-list-item { list-style: none; margin-left: -1.5em; }

        .editor-textarea {
          font-family: 'SF Mono', Monaco, Consolas, monospace;
          font-size: 14px;
          line-height: 1.6;
          tab-size: 2;
        }

        .toolbar-btn {
          @apply p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors;
        }
      `}</style>

      <div className={`bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 ${isFullscreen ? 'w-full h-full max-w-none max-h-none' : 'w-full max-w-6xl max-h-[90vh]'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
          <div className="flex items-center gap-3">
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
              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-500" />
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
            {/* View mode toggle */}
            {editing && (
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mr-2">
                <button
                  onClick={() => setViewMode('edit')}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'edit' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Edit
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'split' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Split
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'preview' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Preview
                </button>
              </div>
            )}

            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            {/* Download button */}
            <a
              href={`/api/documentation/files/${file._id}`}
              download={file.name}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </a>

            {canEdit && !editing && (
              <button
                onClick={handleStartEditing}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Undo"
                >
                  <Undo className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Redo"
                >
                  <Redo className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-200 mx-1" />
                <button
                  onClick={() => insertText('**', '**')}
                  className="toolbar-btn"
                  title="Bold"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  onClick={() => insertText('*', '*')}
                  className="toolbar-btn"
                  title="Italic"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  onClick={() => insertText('# ')}
                  className="toolbar-btn"
                  title="Heading"
                >
                  <Heading className="w-4 h-4" />
                </button>
                <button
                  onClick={() => insertText('- ')}
                  className="toolbar-btn"
                  title="Bullet List"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => insertText('> ')}
                  className="toolbar-btn"
                  title="Quote"
                >
                  <Quote className="w-4 h-4" />
                </button>
                <button
                  onClick={() => insertText('`', '`')}
                  className="toolbar-btn"
                  title="Code"
                >
                  <Code className="w-4 h-4" />
                </button>
                <button
                  onClick={() => insertText('[', '](url)')}
                  className="toolbar-btn"
                  title="Link"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-200 mx-1" />
                <button
                  onClick={handleDiscardChanges}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Discard
                </button>
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving || content === originalContent}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    content === originalContent
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
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
        <div className={`flex-1 overflow-hidden bg-white ${isFullscreen ? 'h-screen' : 'h-[calc(90vh-140px)]'}`}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                  <FileText className="w-5 h-5 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-gray-500 text-sm font-medium">Loading markdown file…</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-red-500">
                <AlertCircle className="w-8 h-8" />
                <p className="text-sm font-medium">{error}</p>
                <button
                  onClick={() => fetchFileContent(file._id)}
                  className="px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex overflow-hidden">
              {/* Editor */}
              {(editing && (viewMode === 'edit' || viewMode === 'split')) && (
                <div className={`flex-1 flex flex-col ${viewMode === 'split' ? 'border-r border-gray-200' : ''}`}>
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      addToHistory(e.target.value);
                    }}
                    onScroll={handleScroll}
                    placeholder="Write your markdown here..."
                    className="editor-textarea w-full h-full p-6 outline-none resize-none text-gray-800 bg-white overflow-auto"
                    autoFocus
                  />
                </div>
              )}

              {/* Preview */}
              {((!editing && viewMode !== 'edit') || viewMode === 'split' || viewMode === 'preview') && (
                <div className={`flex-1 ${viewMode === 'edit' ? '' : viewMode === 'split' ? 'flex-1' : 'flex-1'}`}>
                  <div
                    ref={previewRef}
                    className="h-full overflow-auto p-6 markdown-preview"
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />
                  {rendering && (
                    <div className="absolute top-4 right-4 text-xs text-gray-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Rendering...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Markdown
            </span>
            <span>•</span>
            <span>{charCount} chars</span>
            <span>•</span>
            <span>{wordCount} words</span>
            <span>•</span>
            <span>{lineCount} lines</span>
            <span>•</span>
            <span>~{readingTime} min read</span>
          </div>
          {canEdit && editing && (
            <div className="text-xs text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Auto-saving enabled
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
