'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Download, ZoomIn, ZoomOut, Minimize2, Maximize2,
  ChevronLeft, ChevronRight, Globe, Lock, AlertCircle,
  FileText, FileImage, FileVideo, Music, FileCode, FileArchive,
  Loader2, Eye, EyeOff
} from 'lucide-react';

// File type detection
function getFileType(fileName, mimeType = '') {
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (['pdf'].includes(ext)) return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'].includes(ext)) return 'audio';
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'hpp', 'rb', 'php'].includes(ext)) return 'code';
  if (['html', 'css', 'json', 'xml', 'yaml', 'yml', 'md', 'txt'].includes(ext)) return 'text';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'archive';
  if (['doc', 'docx'].includes(ext)) return 'document';
  if (['xls', 'xlsx'].includes(ext)) return 'spreadsheet';
  if (['ppt', 'pptx'].includes(ext)) return 'presentation';

  // Check MIME type as fallback
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('image/')) return 'image';
  if (mimeType.includes('video/')) return 'video';
  if (mimeType.includes('audio/')) return 'audio';
  if (mimeType.includes('text/')) return 'text';

  return 'unknown';
}

// Format file size
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

// Storage provider badge
function getStorageProviderBadge(provider) {
  const badges = {
    'server': { label: 'Server', color: 'bg-blue-50 text-blue-600 border-blue-200' },
    'google-drive': { label: 'Google Drive', color: 'bg-red-50 text-red-600 border-red-200' },
    'onedrive': { label: 'OneDrive', color: 'bg-blue-50 text-blue-600 border-blue-200' },
    'mega': { label: 'Mega', color: 'bg-purple-50 text-purple-600 border-purple-200' },
    'mediafire': { label: 'MediaFire', color: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  };
  return badges[provider] || badges['server'];
}

// Image Viewer Component
function ImageViewer({ file, onClose, canDownload = true }) {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const imgRef = useRef(null);

  const handleWheel = (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.max(0.25, Math.min(3, z + delta)));
    }
  };

  // Prevent right-click context menu
  const handleContextMenu = (e) => {
    e.preventDefault();
    return false;
  };

  useEffect(() => {
    const img = imgRef.current;
    if (img) {
      img.addEventListener('wheel', handleWheel, { passive: false });
      img.addEventListener('contextmenu', handleContextMenu);
      return () => {
        img.removeEventListener('wheel', handleWheel);
        img.removeEventListener('contextmenu', handleContextMenu);
      };
    }
  }, []);

  const imageUrl = file.externalUrl || `/api/resources/${file._id}/view`;

  return (
    <div className={`flex flex-col bg-gray-900 ${isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-[70vh]'}`}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/90 backdrop-blur border-b border-gray-700">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <FileImage className="w-5 h-5 text-pink-400" />
            <span className="text-white font-medium truncate max-w-[200px]">{file.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
            title="File info"
          >
            <FileText className="w-5 h-5" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-white text-sm font-medium px-2 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors" title="Fullscreen">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {canDownload && (
            <a href={file.externalUrl || `/api/resources/${file._id}/download`} download={file.name} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download
            </a>
          )}
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">File Type</p>
              <p className="text-sm font-medium text-white capitalize">{getFileType(file.name, file.mimeType)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Size</p>
              <p className="text-sm font-medium text-white">{formatFileSize(file.fileSize)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Storage</p>
              <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStorageProviderBadge(file.storageProvider || 'server').color}`}>
                {getStorageProviderBadge(file.storageProvider || 'server').label}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Uploaded By</p>
              <p className="text-sm font-medium text-white">{file.uploadedBy?.username || 'Unknown'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Image */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-8" onContextMenu={handleContextMenu}>
        <img
          ref={imgRef}
          src={imageUrl}
          alt={file.name}
          style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease-out', maxWidth: '100%', maxHeight: '100%', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: zoom !== 1 ? 'none' : 'auto' }}
          className="object-contain"
          onContextMenu={handleContextMenu}
          onDragStart={(e) => e.preventDefault()}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/api/placeholder/400/300';
          }}
        />
      </div>

      {file.isPasswordProtected && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-amber-500/90 text-white text-xs font-medium rounded-full flex items-center gap-2">
          <Lock className="w-3 h-3" />
          Password Protected
        </div>
      )}
    </div>
  );
}

// PDF Viewer Component
function PDFViewer({ file, onClose, canDownload = true }) {
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const iframeRef = useRef(null);

  const pdfUrl = file.externalUrl || `/api/resources/${file._id}/view`;

  return (
    <div className="flex flex-col h-[70vh] bg-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-500" />
            <span className="font-medium text-gray-900 truncate max-w-[300px]">{file.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
            title="File info"
          >
            <FileText className="w-5 h-5" />
          </button>
          {canDownload && (
            <a href={file.externalUrl || `/api/resources/${file._id}/download`} download={file.name} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download
            </a>
          )}
        </div>
      </div>

      {showInfo && (
        <div className="bg-gray-50 border-b border-gray-200 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">File Type</p>
              <p className="text-sm font-medium text-gray-900 capitalize">PDF Document</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Size</p>
              <p className="text-sm font-medium text-gray-900">{formatFileSize(file.fileSize)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Storage</p>
              <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStorageProviderBadge(file.storageProvider || 'server').color}`}>
                {getStorageProviderBadge(file.storageProvider || 'server').label}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Uploaded By</p>
              <p className="text-sm font-medium text-gray-900">{file.uploadedBy?.username || 'Unknown'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={pdfUrl}
          className="w-full h-full border-0"
          onLoad={() => setLoading(false)}
          title={file.name}
        />
      </div>
    </div>
  );
}

// Video Viewer Component
function VideoViewer({ file, onClose, canDownload = true }) {
  const videoRef = useRef(null);

  const videoUrl = file.externalUrl || `/api/resources/${file._id}/view`;

  return (
    <div className="flex flex-col items-center justify-center bg-black w-full">
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
        {canDownload && (
          <a href={file.externalUrl || `/api/resources/${file._id}/download`} download={file.name} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Download
          </a>
        )}
      </div>
      <div className="w-full max-w-5xl aspect-video">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          autoPlay
          className="w-full h-full"
          onContextMenu={(e) => e.preventDefault()}
        >
          Your browser does not support video playback.
        </video>
      </div>
    </div>
  );
}

// Audio Viewer Component
function AudioViewer({ file, onClose, canDownload = true }) {
  const audioRef = useRef(null);

  const audioUrl = file.externalUrl || `/api/resources/${file._id}/view`;

  return (
    <div className="flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900 w-full py-12">
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
        <audio ref={audioRef} src={audioUrl} controls autoPlay className="w-80" onContextMenu={(e) => e.preventDefault()}>
          Your browser does not support audio playback.
        </audio>
        {canDownload && (
          <a href={file.externalUrl || `/api/resources/${file._id}/download`} download={file.name} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Download
          </a>
        )}
      </div>
    </div>
  );
}

// Code/Text Viewer Component
function CodeViewer({ file, onClose, canDownload = true }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch(file.externalUrl || `/api/resources/${file._id}/view`);
        if (response.ok) {
          const text = await response.text();
          setContent(text);
        } else {
          setError('Failed to load file content');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [file]);

  return (
    <div className="flex flex-col h-[70vh] bg-white rounded-xl overflow-hidden border border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-emerald-500" />
            <span className="font-medium text-gray-900 truncate max-w-[300px]">{file.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canDownload && (
            <a href={file.externalUrl || `/api/resources/${file._id}/download`} download={file.name} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download
            </a>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-gray-900">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-400">
            <AlertCircle className="w-8 h-8 mr-2" />
            {error}
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

// Unknown/Archive Viewer (fallback)
function UnknownViewer({ file, onClose, canDownload = true }) {
  const fileType = getFileType(file.name, file.mimeType);

  const getIcon = () => {
    switch (fileType) {
      case 'archive': return <FileArchive className="w-16 h-16 text-amber-500" />;
      case 'document': return <FileText className="w-16 h-16 text-blue-500" />;
      case 'spreadsheet': return <FileText className="w-16 h-16 text-green-500" />;
      case 'presentation': return <FileText className="w-16 h-16 text-orange-500" />;
      default: return <FileText className="w-16 h-16 text-gray-400" />;
    }
  };

  const getDisplayName = () => {
    if (fileType === 'unknown') return 'Unknown File Type';
    return fileType.charAt(0).toUpperCase() + fileType.slice(1);
  };

  return (
    <div className="flex flex-col items-center justify-center bg-gray-50 w-full py-16">
      <div className="flex flex-col items-center gap-4">
        {getIcon()}
        <div className="text-center">
          <h3 className="text-gray-900 text-lg font-semibold">{file.name}</h3>
          <p className="text-gray-500 text-sm mt-1">{formatFileSize(file.fileSize)}</p>
          <p className="text-gray-400 text-xs mt-1">{getDisplayName()}</p>
          {fileType === 'archive' && (
            <p className="text-amber-600 text-xs mt-2 flex items-center gap-1 justify-center">
              <AlertCircle className="w-3 h-3" />
              Archive files cannot be previewed
            </p>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors">
            Close
          </button>
          {canDownload && (
            <a href={file.externalUrl || `/api/resources/${file._id}/download`} download={file.name} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// Main DocumentViewer Component
export default function DocumentViewer({ file, onClose, canDownload = true }) {
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [verified, setVerified] = useState(false);

  const fileType = getFileType(file.name, file.mimeType);

  // Check if file is password protected
  useEffect(() => {
    if (file.isPasswordProtected && !verified) {
      setShowPasswordInput(true);
    }
  }, [file, verified]);

  const handlePasswordSubmit = async () => {
    try {
      const response = await fetch(`/api/resources/${file._id}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        setVerified(true);
        setShowPasswordInput(false);
      } else {
        setPasswordError('Incorrect password');
      }
    } catch (err) {
      setPasswordError('Failed to verify password');
    }
  };

  const renderViewer = () => {
    if (file.externalUrl) {
      // External storage - open in new tab or show link
      return (
        <div className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 w-full py-16">
          <div className="flex flex-col items-center gap-6 max-w-md">
            <div className="w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center">
              <Globe className="w-12 h-12 text-blue-500" />
            </div>
            <div className="text-center">
              <h3 className="text-gray-900 text-lg font-semibold">{file.name}</h3>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStorageProviderBadge(file.storageProvider).color}`}>
                  {getStorageProviderBadge(file.storageProvider).label}
                </span>
              </div>
              <p className="text-gray-600 text-sm mt-4">
                This file is stored externally. Click the button below to view it.
              </p>
            </div>
            <a
              href={file.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/30"
            >
              <Globe className="w-4 h-4" />
              Open in {file.storageProvider === 'google-drive' ? 'Google Drive' : file.storageProvider === 'onedrive' ? 'OneDrive' : file.storageProvider}
            </a>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
              Close
            </button>
          </div>
        </div>
      );
    }

    // Internal/server storage - show appropriate viewer
    switch (fileType) {
      case 'image':
        return <ImageViewer file={file} onClose={onClose} canDownload={canDownload} />;
      case 'pdf':
        return <PDFViewer file={file} onClose={onClose} canDownload={canDownload} />;
      case 'video':
        return <VideoViewer file={file} onClose={onClose} canDownload={canDownload} />;
      case 'audio':
        return <AudioViewer file={file} onClose={onClose} canDownload={canDownload} />;
      case 'code':
      case 'text':
        return <CodeViewer file={file} onClose={onClose} canDownload={canDownload} />;
      default:
        return <UnknownViewer file={file} onClose={onClose} canDownload={canDownload} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden animate-modal-in">
        {showPasswordInput ? (
          <div className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                <Lock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Password Required</h3>
                <p className="text-sm text-gray-500 truncate">{file.name}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Enter Password
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit(); if (e.key === 'Escape') onClose(); }}
                  placeholder="Enter the password to view this file"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none transition-all"
                  autoFocus
                />
                {passwordError && (
                  <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {passwordError}
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
                  disabled={!password}
                  className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Unlock File
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
