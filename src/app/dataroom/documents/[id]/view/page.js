'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '../../../../../hooks/useAuth';
import SecureLoading from '../../../../components/SecureLoading';
import {
  ArrowLeft,
  Download,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  FileText,
  Printer,
} from 'lucide-react';

// pdf.js touches window during module evaluation, so the viewer must not be
// server-rendered.
const PdfCanvasViewer = dynamic(() => import('../../../../components/PdfCanvasViewer'), {
  ssr: false,
});

const HEARTBEAT_MS = 30_000;

export default function DocumentViewerPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id;
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [notice, setNotice] = useState(null);
  const printerRef = useRef(null);

  const streamUrl = doc ? `/api/dataroom/documents/${documentId}/view` : null;
  const caps = doc?.capabilities || {};

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/dataroom/documents/${documentId}`, {
          credentials: 'include',
        });
        if (cancelled) return;
        if (!res.ok) {
          router.push(`/dataroom/request-access?type=document&id=${documentId}`);
          return;
        }
        setDoc(await res.json());
      } catch {
        if (!cancelled) setNotice('Could not load this document.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId, router]);

  // Activity heartbeat. The cleanup used to be returned from a plain function
  // called inside the effect rather than from the effect itself, so every
  // mount left an interval running for the life of the tab.
  useEffect(() => {
    if (!documentId) return undefined;

    const beat = () =>
      fetch('/api/dataroom/activity/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ documentId, roomId: doc?.roomId, action: 'viewing' }),
      }).catch(() => {});

    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [documentId, doc?.roomId]);

  const onPdfLoad = useCallback(({ numPages }) => {
    setTotalPages(numPages);
    setCurrentPage((p) => Math.min(p, numPages));
  }, []);

  const registerPrinter = useCallback((fn) => {
    printerRef.current = fn;
  }, []);

  async function handleDownload() {
    // `doc`, not `document`: this function previously named its state variable
    // `document`, which shadowed the global one, so `document.createElement`
    // threw and downloading never worked at all.
    try {
      const res = await fetch(`/api/dataroom/documents/${documentId}/download`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setNotice(body.error || 'Download not permitted.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = doc?.fileName || 'document';
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setNotice('Download failed.');
    }
  }

  async function handlePrint() {
    // The server decides, and records, whether this viewer may print. The
    // client-side render happens only after it says yes.
    const res = await fetch(`/api/dataroom/documents/${documentId}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pages: totalPages }),
    }).catch(() => null);

    if (!res?.ok) {
      setNotice('Printing is not permitted for this document.');
      return;
    }
    await printerRef.current?.();
  }

  if (authLoading) return <SecureLoading />;
  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white text-lg">Loading document...</p>
        </div>
      </div>
    );
  }

  const isPdf = doc?.mimeType === 'application/pdf';
  const isImage = doc?.mimeType?.startsWith('image/');

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
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
                <h1 className="text-white font-semibold text-lg">{doc?.name}</h1>
                <p className="text-slate-400 text-sm">
                  {doc?.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(2)} MB • ` : ''}
                  Version {doc?.currentVersion || 1}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 bg-slate-700 rounded-lg px-2 py-1">
              <button
                onClick={() => setZoom(Math.max(25, zoom - 25))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-white text-sm px-2 w-16 text-center">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(300, zoom + 25))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {isPdf && (
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
                  disabled={currentPage >= totalPages}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Controls appear only where the grant exists. The server checks
                again on the way in — this is about not offering what will be
                refused, not about enforcement. */}
            {isPdf && caps.canPrint && (
              <button
                onClick={handlePrint}
                className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 flex items-center space-x-2 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
            )}

            {caps.canDownload && (
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            )}
          </div>
        </div>

        {notice && (
          <p className="mt-2 text-sm text-amber-300" role="status">
            {notice}
          </p>
        )}
      </header>

      <div className="flex-1 overflow-auto bg-slate-800 p-8">
        <div className="max-w-5xl mx-auto flex justify-center">
          {isPdf && streamUrl && (
            <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
              <PdfCanvasViewer
                url={streamUrl}
                zoom={zoom}
                page={currentPage}
                watermark="CONFIDENTIAL"
                onLoad={onPdfLoad}
                registerPrinter={registerPrinter}
              />
            </div>
          )}

          {isImage && streamUrl && (
            <div className="relative bg-white rounded-lg shadow-2xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={streamUrl}
                alt={doc.name}
                style={{ width: `${zoom}%` }}
                className="block h-auto"
              />
              <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center">
                <span className="text-5xl font-bold text-slate-900/10 rotate-45 whitespace-nowrap">
                  CONFIDENTIAL
                </span>
              </div>
            </div>
          )}

          {!isPdf && !isImage && (
            <div className="bg-white rounded-lg shadow-2xl p-12 text-center">
              <FileText className="w-24 h-24 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Preview not available</h3>
              <p className="text-slate-600 mb-6">
                This file type cannot be rendered in the browser.
              </p>
              {caps.canDownload ? (
                <button
                  onClick={handleDownload}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center space-x-2"
                >
                  <Download className="w-5 h-5" />
                  <span>Download to view</span>
                </button>
              ) : (
                <p className="text-sm text-slate-500">
                  You do not have permission to download this file.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="bg-slate-800 border-t border-slate-700 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <div className="flex items-center space-x-4">
            <span>Uploaded by {doc?.createdBy?.email}</span>
            <span>•</span>
            <span>{doc?.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Secure connection</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
