'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Download, ZoomIn, ZoomOut, Minimize2, Maximize2,
  Globe, Lock, AlertCircle,
  FileText, FileImage, FileVideo, Music, FileCode, FileArchive,
  Loader2, Eye, EyeOff, ExternalLink
} from 'lucide-react';

// ─── File type detection ──────────────────────────────────────────────────────

function getFileType(fileName, mimeType = '') {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext))                                                             return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext))        return 'image';
  if (['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv'].includes(ext))                       return 'video';
  if (['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'].includes(ext))                       return 'audio';
  if (['js','jsx','ts','tsx','py','java','go','rs','c','cpp','h','hpp','rb','php'].includes(ext)) return 'code';
  if (['html', 'css', 'json', 'xml', 'yaml', 'yml', 'md', 'txt'].includes(ext))        return 'text';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext))                          return 'archive';
  if (['docx'].includes(ext))                                                            return 'docx';
  if (['doc'].includes(ext))                                                             return 'doc';
  if (['xlsx', 'xls'].includes(ext))                                                    return 'spreadsheet';
  if (['pptx', 'ppt'].includes(ext))                                                    return 'presentation';
  if (mimeType.includes('pdf'))    return 'pdf';
  if (mimeType.includes('image/')) return 'image';
  if (mimeType.includes('video/')) return 'video';
  if (mimeType.includes('audio/')) return 'audio';
  if (mimeType.includes('text/'))  return 'text';
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'docx';
  if (mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel'))  return 'spreadsheet';
  if (mimeType.includes('presentationml') || mimeType.includes('powerpoint')) return 'presentation';
  return 'unknown';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function getStorageProviderBadge(provider) {
  const badges = {
    'server':       { label: 'Server',       color: 'bg-blue-50 text-blue-600 border-blue-200'     },
    'google-drive': { label: 'Google Drive', color: 'bg-red-50 text-red-600 border-red-200'        },
    'onedrive':     { label: 'OneDrive',     color: 'bg-blue-50 text-blue-600 border-blue-200'     },
    'mega':         { label: 'Mega',         color: 'bg-purple-50 text-purple-600 border-purple-200'},
    'mediafire':    { label: 'MediaFire',    color: 'bg-yellow-50 text-yellow-600 border-yellow-200'},
  };
  return badges[provider] || badges['server'];
}

function fileViewUrl(file)     { return file.externalUrl || `/api/resources/${file._id}/view`;     }
function fileDownloadUrl(file) { return file.externalUrl || `/api/resources/${file._id}/download`; }

// Shared info panel used by multiple viewers
function InfoPanel({ file, light = false }) {
  const label  = light ? 'text-gray-500' : 'text-gray-400';
  const value  = light ? 'text-gray-900' : 'text-white';
  const badge  = getStorageProviderBadge(file.storageProvider || 'server');
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 p-4 ${light ? 'bg-gray-50 border-b border-gray-200' : 'bg-gray-800 border-b border-gray-700'}`}>
      {[
        { label: 'File Type',    val: getFileType(file.name, file.mimeType) },
        { label: 'Size',         val: formatFileSize(file.fileSize)          },
        { label: 'Uploaded By',  val: file.uploadedBy?.username || 'Unknown'  },
      ].map(({ label: l, val }) => (
        <div key={l}>
          <p className={`text-xs mb-1 ${label}`}>{l}</p>
          <p className={`text-sm font-medium capitalize ${value}`}>{val}</p>
        </div>
      ))}
      <div>
        <p className={`text-xs mb-1 ${label}`}>Storage</p>
        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full border ${badge.color}`}>
          {badge.label}
        </span>
      </div>
    </div>
  );
}

// ─── Download button ──────────────────────────────────────────────────────────

function DownloadBtn({ file, small = false }) {
  return (
    <a
      href={fileDownloadUrl(file)}
      download={file.name}
      className={`bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 ${
        small ? 'px-3 py-2 text-sm' : 'px-4 py-2 text-sm'
      }`}
    >
      <Download className="w-4 h-4" />
      Download
    </a>
  );
}

// ─── ImageViewer ──────────────────────────────────────────────────────────────

function ImageViewer({ file, onClose, canDownload }) {
  const [zoom,         setZoom]         = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInfo,     setShowInfo]     = useState(false);
  const containerRef = useRef(null);

  // Bug fix: define handler with useCallback so the ref in useEffect is stable
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setZoom(z => Math.max(0.25, Math.min(3, z + (e.deltaY > 0 ? -0.1 : 0.1))));
    }
  }, []);

  const preventCtxMenu = useCallback((e) => e.preventDefault(), []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('contextmenu', preventCtxMenu);
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('contextmenu', preventCtxMenu);
    };
  }, [handleWheel, preventCtxMenu]);

  return (
    <div className={`flex flex-col bg-gray-900 ${isFullscreen ? 'fixed inset-0 z-[60]' : 'w-full h-[70vh]'}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/90 backdrop-blur border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
          <FileImage className="w-5 h-5 text-pink-400 shrink-0" />
          <span className="text-white font-medium truncate">{file.name}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setShowInfo(v => !v)} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors" title="File info">
            <FileText className="w-4 h-4" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={() => setZoom(1)} className="text-white text-xs font-mono px-2 w-12 text-center hover:bg-white/10 rounded py-1 transition-colors">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => setIsFullscreen(v => !v)} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors" title="Fullscreen">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {canDownload && <DownloadBtn file={file} small />}
        </div>
      </div>
      {showInfo && <InfoPanel file={file} />}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-auto p-8" onContextMenu={preventCtxMenu}>
        <img
          src={fileViewUrl(file)}
          alt={file.name}
          style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease-out', maxWidth: '100%', maxHeight: '100%', userSelect: 'none', WebkitUserSelect: 'none' }}
          className="object-contain"
          onContextMenu={preventCtxMenu}
          onDragStart={e => e.preventDefault()}
          onError={e => { e.currentTarget.src = ''; }}
        />
      </div>
    </div>
  );
}

// ─── PDFViewer ────────────────────────────────────────────────────────────────

function PDFViewer({ file, onClose, canDownload }) {
  const [loading,  setLoading]  = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="flex flex-col h-[70vh] bg-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
          <FileText className="w-5 h-5 text-red-500 shrink-0" />
          <span className="font-medium text-gray-900 truncate">{file.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowInfo(v => !v)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors" title="File info">
            <FileText className="w-4 h-4" />
          </button>
          {canDownload && <DownloadBtn file={file} small />}
        </div>
      </div>
      {showInfo && <InfoPanel file={file} light />}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        )}
        <iframe
          src={fileViewUrl(file)}
          className="w-full h-full border-0"
          onLoad={() => setLoading(false)}
          title={file.name}
        />
      </div>
    </div>
  );
}

// ─── VideoViewer ──────────────────────────────────────────────────────────────

function VideoViewer({ file, onClose, canDownload }) {
  return (
    // Bug fix: added `relative` so absolute children position correctly
    <div className="relative flex flex-col items-center justify-center bg-black w-full min-h-[400px]">
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
        {canDownload && <DownloadBtn file={file} small />}
      </div>
      <div className="w-full max-w-5xl aspect-video">
        <video
          src={fileViewUrl(file)}
          controls
          autoPlay
          className="w-full h-full"
          onContextMenu={e => e.preventDefault()}
        >
          Your browser does not support video playback.
        </video>
      </div>
    </div>
  );
}

// ─── AudioViewer ──────────────────────────────────────────────────────────────

function AudioViewer({ file, onClose, canDownload }) {
  return (
    <div className="relative flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900 w-full py-12">
      <div className="absolute top-4 left-4">
        <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex flex-col items-center gap-6">
        <div className="w-32 h-32 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-2xl">
          <Music className="w-16 h-16 text-white" />
        </div>
        <div className="text-center">
          <h3 className="text-white text-lg font-semibold">{file.name}</h3>
          <p className="text-white/60 text-sm mt-1">{formatFileSize(file.fileSize)}</p>
        </div>
        <audio src={fileViewUrl(file)} controls autoPlay className="w-80" onContextMenu={e => e.preventDefault()}>
          Your browser does not support audio playback.
        </audio>
        {canDownload && <DownloadBtn file={file} />}
      </div>
    </div>
  );
}

// ─── CodeViewer ───────────────────────────────────────────────────────────────

function CodeViewer({ file, onClose, canDownload }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetch(fileViewUrl(file))
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.text(); })
      .then(text => { setContent(text); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [file]);

  return (
    <div className="flex flex-col h-[70vh] bg-white rounded-xl overflow-hidden border border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
          <FileCode className="w-5 h-5 text-emerald-500 shrink-0" />
          <span className="font-medium text-gray-900 truncate">{file.name}</span>
        </div>
        {canDownload && <DownloadBtn file={file} small />}
      </div>
      <div className="flex-1 overflow-auto bg-gray-900">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" /><span>{error}</span>
          </div>
        ) : (
          <pre className="p-4 text-sm text-gray-100 font-mono whitespace-pre-wrap break-words">
            <code>{content}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

// ─── DocxViewer ───────────────────────────────────────────────────────────────
// Uses mammoth.js (loaded from CDN) to convert docx → HTML in the browser.
// Works with private/authenticated file URLs since the fetch goes through
// your own API — no external viewer needs to reach the file.

function DocxViewer({ file, onClose, canDownload }) {
  const [html,    setHtml]    = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;

    const convert = async () => {
      try {
        // Load mammoth from CDN if not already present
        if (!window.mammoth) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
            s.onload  = resolve;
            s.onerror = () => reject(new Error('Failed to load mammoth.js'));
            document.head.appendChild(s);
          });
        }

        const res = await fetch(fileViewUrl(file));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;

        const result = await window.mammoth.convertToHtml({ arrayBuffer });
        if (cancelled) return;

        setHtml(result.value);
        if (result.messages?.length) console.warn('mammoth warnings:', result.messages);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    convert();
    return () => { cancelled = true; };
  }, [file]);

  return (
    <div className="flex flex-col h-[70vh] bg-white rounded-xl overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
          <FileText className="w-5 h-5 text-blue-600 shrink-0" />
          <span className="font-medium text-gray-900 truncate">{file.name}</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md shrink-0">DOCX</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400 hidden sm:inline">{formatFileSize(file.fileSize)}</span>
          {canDownload && <DownloadBtn file={file} small />}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm text-gray-400">Converting document…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <div>
              <p className="text-sm font-semibold text-gray-700">Could not preview this document</p>
              <p className="text-xs text-gray-400 mt-1">{error}</p>
            </div>
            {canDownload && (
              <div className="mt-2">
                <DownloadBtn file={file} />
              </div>
            )}
          </div>
        ) : (
          // Rendered HTML in a scoped container with Word-like styling
          <div
            className="max-w-3xl mx-auto px-10 py-8"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 1.7, color: '#1a1a1a' }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}

// ─── OfficeOnlineViewer ───────────────────────────────────────────────────────
// For xlsx, xls, pptx, ppt — uses Microsoft Office Online viewer.
// Requires the file URL to be publicly reachable. If the file is behind auth,
// falls back to a download prompt with a clear explanation.

function OfficeOnlineViewer({ file, onClose, canDownload, type }) {
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  const isExternalOrPublic = !!file.externalUrl || file.isPublic;
  const srcUrl = fileViewUrl(file);
  const officeUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(srcUrl)}`;

  const typeLabel = type === 'spreadsheet' ? 'Spreadsheet' : 'Presentation';
  const TypeIcon  = type === 'spreadsheet' ? FileText : FileText;
  const iconColor = type === 'spreadsheet' ? 'text-green-600' : 'text-orange-500';

  // If file is private/internal, Office Online can't reach it — show fallback
  if (!isExternalOrPublic) {
    return (
      <div className="flex flex-col h-[70vh] bg-white rounded-xl overflow-hidden border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
            <TypeIcon className={`w-5 h-5 shrink-0 ${iconColor}`} />
            <span className="font-medium text-gray-900 truncate">{file.name}</span>
          </div>
          {canDownload && <DownloadBtn file={file} small />}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center">
            <TypeIcon className={`w-8 h-8 ${iconColor}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{typeLabel} preview not available</p>
            <p className="text-xs text-gray-400 mt-1.5 max-w-xs leading-relaxed">
              {typeLabel} files require Microsoft Office Online to preview, which needs a publicly accessible URL.
              This file is stored privately on your server.
            </p>
          </div>
          {canDownload && (
            <div className="flex flex-col items-center gap-2">
              <DownloadBtn file={file} />
              <p className="text-xs text-gray-400">Open in Excel / PowerPoint to view</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[70vh] bg-white rounded-xl overflow-hidden border border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
          <TypeIcon className={`w-5 h-5 shrink-0 ${iconColor}`} />
          <span className="font-medium text-gray-900 truncate">{file.name}</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md shrink-0">
            Office Online
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href={officeUrl} target="_blank" rel="noopener noreferrer"
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors" title="Open in Office Online">
            <ExternalLink className="w-4 h-4" />
          </a>
          {canDownload && <DownloadBtn file={file} small />}
        </div>
      </div>
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="text-sm text-gray-400">Loading Office viewer…</p>
            </div>
          </div>
        )}
        <iframe
          src={officeUrl}
          className="w-full h-full border-0"
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setUseFallback(true); }}
          title={file.name}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}

// ─── UnknownViewer ────────────────────────────────────────────────────────────

function UnknownViewer({ file, onClose, canDownload }) {
  const fileType = getFileType(file.name, file.mimeType);
  const icons = {
    archive:      <FileArchive className="w-16 h-16 text-amber-500" />,
    document:     <FileText    className="w-16 h-16 text-blue-500" />,
    spreadsheet:  <FileText    className="w-16 h-16 text-green-500" />,
    presentation: <FileText    className="w-16 h-16 text-orange-500" />,
  };
  const displayName = fileType === 'unknown'
    ? 'Unknown File Type'
    : fileType.charAt(0).toUpperCase() + fileType.slice(1);

  return (
    <div className="flex flex-col items-center justify-center bg-gray-50 w-full py-16">
      <div className="flex flex-col items-center gap-4">
        {icons[fileType] || <FileText className="w-16 h-16 text-gray-400" />}
        <div className="text-center">
          <h3 className="text-gray-900 text-lg font-semibold">{file.name}</h3>
          <p className="text-gray-500 text-sm mt-1">{formatFileSize(file.fileSize)}</p>
          <p className="text-gray-400 text-xs mt-1">{displayName}</p>
          {fileType === 'archive' && (
            <p className="text-amber-600 text-xs mt-2 flex items-center gap-1 justify-center">
              <AlertCircle className="w-3 h-3" /> Archive files cannot be previewed
            </p>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors">
            Close
          </button>
          {canDownload && <DownloadBtn file={file} />}
        </div>
      </div>
    </div>
  );
}

// ─── ExternalViewer ───────────────────────────────────────────────────────────

function ExternalViewer({ file, onClose }) {
  const badge = getStorageProviderBadge(file.storageProvider || 'server');
  const providerName = {
    'google-drive': 'Google Drive',
    'onedrive':     'OneDrive',
    'mega':         'Mega',
    'mediafire':    'MediaFire',
  }[file.storageProvider] || file.storageProvider || 'external storage';

  return (
    <div className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 w-full py-16">
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        <div className="w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center">
          <Globe className="w-12 h-12 text-blue-500" />
        </div>
        <div>
          <h3 className="text-gray-900 text-lg font-semibold">{file.name}</h3>
          <span className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full border ${badge.color}`}>
            {badge.label}
          </span>
          <p className="text-gray-600 text-sm mt-4">
            This file is stored on {providerName}. Click below to open it.
          </p>
        </div>
        <a
          href={file.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/30"
        >
          <Globe className="w-4 h-4" />
          Open in {providerName}
        </a>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Main DocumentViewer ──────────────────────────────────────────────────────

export default function DocumentViewer({ file, onClose, canDownload = true }) {
  const [password,      setPassword]      = useState('');
  const [showPwInput,   setShowPwInput]   = useState(false);
  const [showPwText,    setShowPwText]    = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [verifying,     setVerifying]     = useState(false);
  const [verified,      setVerified]      = useState(false);

  const fileType = getFileType(file.name, file.mimeType);

  // Show password gate if protected and not yet verified
  useEffect(() => {
    if (file.isPasswordProtected && !verified) setShowPwInput(true);
    else setShowPwInput(false);
  }, [file, verified]);

  // Escape closes modal
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handlePasswordSubmit = async () => {
    if (!password || verifying) return;
    setVerifying(true);
    setPasswordError('');
    try {
      const res = await fetch(`/api/resources/${file._id}/verify-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      });
      if (res.ok) { setVerified(true); setShowPwInput(false); }
      else        setPasswordError('Incorrect password. Please try again.');
    } catch {
      setPasswordError('Could not verify password. Check your connection.');
    } finally {
      setVerifying(false);
    }
  };

  const renderViewer = () => {
    // External storage URL — show link-out screen
    if (file.externalUrl && !['image', 'video', 'audio', 'pdf'].includes(fileType)) {
      return <ExternalViewer file={file} onClose={onClose} />;
    }

    switch (fileType) {
      case 'image':        return <ImageViewer        file={file} onClose={onClose} canDownload={canDownload} />;
      case 'pdf':          return <PDFViewer           file={file} onClose={onClose} canDownload={canDownload} />;
      case 'video':        return <VideoViewer         file={file} onClose={onClose} canDownload={canDownload} />;
      case 'audio':        return <AudioViewer         file={file} onClose={onClose} canDownload={canDownload} />;
      case 'code':
      case 'text':         return <CodeViewer          file={file} onClose={onClose} canDownload={canDownload} />;
      case 'docx':
      case 'doc':          return <DocxViewer          file={file} onClose={onClose} canDownload={canDownload} />;
      case 'spreadsheet':  return <OfficeOnlineViewer  file={file} onClose={onClose} canDownload={canDownload} type="spreadsheet"  />;
      case 'presentation': return <OfficeOnlineViewer  file={file} onClose={onClose} canDownload={canDownload} type="presentation" />;
      default:             return <UnknownViewer       file={file} onClose={onClose} canDownload={canDownload} />;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @keyframes modal-in {
          from { opacity:0; transform:translateY(10px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .animate-modal-in { animation: modal-in 0.2s cubic-bezier(0.16,1,0.3,1); }
      `}</style>

      <div className="animate-modal-in bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {showPwInput ? (
          // ── Password gate ──
          <div className="p-8 max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-amber-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-900">Password Required</h3>
                <p className="text-sm text-gray-400 truncate">{file.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Enter Password
                </label>
                {/* Bug fix: password show/hide toggle — Eye/EyeOff were imported but unused */}
                <div className="relative">
                  <input
                    type={showPwText ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setPasswordError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit(); if (e.key === 'Escape') onClose(); }}
                    placeholder="Enter the password to view this file"
                    className="w-full pl-4 pr-10 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none transition-all"
                    autoFocus
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwText(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPwText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-red-600 text-sm mt-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{passwordError}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  disabled={!password || verifying}
                  className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifying ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying…</> : 'Unlock File'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          renderViewer()
        )}
      </div>
    </div>
  );
}