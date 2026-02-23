'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FileText, Share2 } from 'lucide-react';

export default function DocumentViewerPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id;

  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [streamUrl, setStreamUrl] = useState(null);

  useEffect(() => {
    if (documentId) {
      fetchDocument();
      initViewer();
    }
  }, [documentId]);

  async function fetchDocument() {
    try {
      const response = await fetch(`/api/dataroom/documents/${documentId}`);
      if (response.ok) {
        const data = await response.json();
        setDocument(data);
        setStreamUrl(`/api/dataroom/documents/${documentId}/view`);
      } else {
        router.push(`/dataroom/request-access?type=document&id=${documentId}`);
      }
    } catch (error) {
      console.error('Failed to fetch document:', error);
    } finally {
      setLoading(false);
    }
  }

  function initViewer() {
    // Send heartbeat for activity tracking
    fetch('/api/dataroom/activity/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId,
        action: 'viewing',
      }),
    }).catch(() => {});

    // Continue heartbeat every 30 seconds
    const interval = setInterval(() => {
      fetch('/api/dataroom/activity/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          action: 'viewing',
        }),
      }).catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }

  async function handleDownload() {
    try {
      const response = await fetch(`/api/dataroom/documents/${documentId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = document?.fileName || 'document';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Download not permitted');
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Viewer Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <FileText className="w-6 h-6 text-blue-400" />
              <div>
                <h1 className="text-white font-semibold text-lg">{document?.name}</h1>
                <p className="text-slate-400 text-sm">
                  {document?.fileSize ? `${(document.fileSize / 1024 / 1024).toFixed(2)} MB` : ''} • 
                  Version {document?.currentVersion || 1}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Zoom Controls */}
            <div className="flex items-center space-x-1 bg-slate-700 rounded-lg px-2 py-1">
              <button
                onClick={() => setZoom(Math.max(25, zoom - 25))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-white text-sm px-2 w-16 text-center">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 25))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Page Navigation (for PDFs) */}
            <div className="flex items-center space-x-1 bg-slate-700 rounded-lg px-2 py-1">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-white text-sm px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>

            <button className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Document Viewer */}
      <div className="flex-1 overflow-auto bg-slate-800 p-8">
        <div className="max-w-5xl mx-auto">
          {streamUrl ? (
            <div 
              className="bg-white rounded-lg shadow-2xl overflow-hidden"
              style={{ 
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.2s'
              }}
            >
              {document?.mimeType === 'application/pdf' ? (
                <iframe
                  src={streamUrl}
                  className="w-full"
                  style={{ height: '1000px' }}
                  title="Document Viewer"
                />
              ) : document?.mimeType?.startsWith('image/') ? (
                <img
                  src={streamUrl}
                  alt={document.name}
                  className="w-full h-auto"
                />
              ) : (
                <div className="p-12 text-center">
                  <FileText className="w-24 h-24 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">Preview Not Available</h3>
                  <p className="text-slate-600 mb-6">
                    This file type cannot be previewed in the browser.
                  </p>
                  <button
                    onClick={handleDownload}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center space-x-2"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download to View</span>
                  </button>
                </div>
              )}

              {/* Watermark Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-10">
                  <p className="text-6xl font-bold text-slate-900 rotate-45 whitespace-nowrap">
                    CONFIDENTIAL
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-2xl p-12 text-center">
              <FileText className="w-24 h-24 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Loading Document...</h3>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <footer className="bg-slate-800 border-t border-slate-700 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <div className="flex items-center space-x-4">
            <span>Uploaded by {document?.createdBy?.email}</span>
            <span>•</span>
            <span>{new Date(document?.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Secure Connection</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
