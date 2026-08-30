'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

// pdf.js is loaded on demand rather than imported at module scope: it is a
// large dependency and only the viewer needs it, so importing it eagerly would
// put it in the bundle of every page that merely links to a document.
let pdfjsPromise = null;
function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/build/pdf.mjs').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/**
 * Renders a PDF to <canvas> elements.
 *
 * The point is what it does NOT do: it never hands the file to the browser's
 * built-in PDF plugin. That plugin ships its own Download and Print buttons,
 * and "Print → Save as PDF" hands the reader the original file — neither
 * button has any idea what this application's permissions say. Rasterising the
 * pages ourselves is what makes `canDownload` and `canPrint` mean something,
 * because there is no original file in the page to save.
 *
 * ponytail: pages are rendered one at a time on demand rather than
 * virtualised in a continuous scroll. Fine up to the document sizes this
 * module sees; if continuous scrolling is wanted, an IntersectionObserver over
 * per-page canvases is the upgrade.
 */
export default function PdfCanvasViewer({
  url,
  zoom = 100,
  page = 1,
  watermark = null,
  onLoad,
  onError,
  registerPrinter,
}) {
  const canvasRef = useRef(null);
  const pdfRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [message, setMessage] = useState(null);

  // Load the document once per url.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    loadPdfJs()
      .then((pdfjs) =>
        pdfjs.getDocument({
          url,
          withCredentials: true,
          // Let pdf.js fetch by range. The view endpoint answers 206s, so a
          // large document starts rendering after a few tens of kilobytes
          // instead of after the whole file has transferred.
          disableRange: false,
          disableStream: false,
        }).promise,
      )
      .then((pdf) => {
        if (cancelled) {
          pdf.destroy();
          return;
        }
        pdfRef.current = pdf;
        setStatus('ready');
        onLoad?.({ numPages: pdf.numPages });
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(err?.message || 'This document could not be opened.');
        onError?.(err);
      });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [url, onLoad, onError]);

  // Render the requested page whenever it, or the zoom, changes. Re-rendering
  // at the new scale rather than CSS-scaling one bitmap is what keeps text
  // sharp when zoomed in.
  useEffect(() => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (status !== 'ready' || !pdf || !canvas) return;

    let cancelled = false;

    (async () => {
      const pageNumber = Math.min(Math.max(1, page), pdf.numPages);
      const pdfPage = await pdf.getPage(pageNumber);
      if (cancelled) return;

      // Multiply by the device pixel ratio so the canvas is rendered at the
      // screen's real resolution; without it the page is visibly soft on any
      // HiDPI display.
      const dpr = window.devicePixelRatio || 1;
      const viewport = pdfPage.getViewport({ scale: (zoom / 100) * dpr });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

      renderTaskRef.current?.cancel();
      const task = pdfPage.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
      });
      renderTaskRef.current = task;

      try {
        await task.promise;
      } catch (err) {
        // A cancelled render is the normal result of paging quickly.
        if (err?.name !== 'RenderingCancelledException') throw err;
      }
    })().catch((err) => {
      if (!cancelled) {
        setStatus('error');
        setMessage(err?.message || 'This page could not be rendered.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [status, page, zoom]);

  // Printing renders every page afresh into an offscreen container and prints
  // that. The pages are images, so what reaches the printer — or a "Save as
  // PDF" print target — is a rasterised copy carrying the watermark, not the
  // original file.
  const print = useCallback(async () => {
    const pdf = pdfRef.current;
    if (!pdf) return;

    const host = window.document.createElement('div');
    host.id = 'dataroom-print-root';

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const pdfPage = await pdf.getPage(i);
      const viewport = pdfPage.getViewport({ scale: 2 }); // ~144dpi
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

      const wrapper = window.document.createElement('div');
      wrapper.className = 'dataroom-print-page';
      wrapper.appendChild(canvas);
      if (watermark) {
        const mark = window.document.createElement('span');
        mark.className = 'dataroom-print-watermark';
        mark.textContent = watermark;
        wrapper.appendChild(mark);
      }
      host.appendChild(wrapper);
    }

    window.document.body.appendChild(host);
    window.document.body.classList.add('dataroom-printing');

    const cleanup = () => {
      window.document.body.classList.remove('dataroom-printing');
      host.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    window.print();
    // Safari never fires afterprint reliably; the timer is the backstop.
    setTimeout(cleanup, 60_000);
  }, [watermark]);

  useEffect(() => {
    registerPrinter?.(print);
  }, [registerPrinter, print]);

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Rendering document…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="p-12 text-center">
        <h3 className="text-lg font-semibold text-slate-700 mb-2">Could not display this document</h3>
        <p className="text-sm text-slate-600">{message}</p>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <canvas ref={canvasRef} className="block max-w-full h-auto" />
      {watermark && (
        <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center">
          <span className="text-5xl font-bold text-slate-900/10 rotate-45 whitespace-nowrap">
            {watermark}
          </span>
        </div>
      )}
    </div>
  );
}
