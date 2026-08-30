'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

/**
 * The protected reading mode: pages arrive as watermarked images rendered on
 * the server, and the PDF never reaches the browser.
 *
 * This is what makes `view` without `download` true rather than merely
 * enforced-in-the-UI. The canvas viewer still fetched the whole file to draw
 * it, so a reader with devtools could put the ranges back together; here there
 * is nothing to put together.
 *
 * The cost is real and deliberate: no text selection, no in-page search, and
 * larger transfers. Readers who hold `download` get the canvas viewer instead,
 * because degrading the reading experience of someone who may simply take the
 * file buys nothing.
 */

// Snapped server-side too; sending anything else just gets rounded.
const RENDER_WIDTHS = [900, 1400, 2000];

function widthForZoom(zoom) {
  const target = 900 * (zoom / 100);
  return RENDER_WIDTHS.reduce((best, w) =>
    Math.abs(w - target) < Math.abs(best - target) ? w : best,
  );
}

export default function PdfPagesViewer({
  documentId,
  zoom = 100,
  page = 1,
  onLoad,
  onError,
  registerPrinter,
}) {
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [message, setMessage] = useState(null);
  const infoRef = useRef(null);

  const width = widthForZoom(zoom);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    fetch(`/api/dataroom/documents/${documentId}/pages`, { credentials: 'include' })
      .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok || !body.renderable) {
          setStatus('error');
          setMessage(body.error || 'This document cannot be displayed.');
          onError?.(new Error(body.error || 'not renderable'));
          return;
        }
        infoRef.current = body;
        setInfo(body);
        setStatus('ready');
        onLoad?.({ numPages: body.numPages });
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setMessage('Could not reach the server.');
        onError?.(err);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, onLoad, onError]);

  /**
   * Printing fetches every page at print resolution into one offscreen root.
   * The images already carry the reader's watermark from the server, so a
   * "Save as PDF" print target produces a watermarked raster of pages the
   * reader was allowed to see — and still not the original file.
   */
  const print = useCallback(async () => {
    const current = infoRef.current;
    if (!current) return;

    const host = window.document.createElement('div');
    host.id = 'dataroom-print-root';

    for (let i = 1; i <= current.numPages; i += 1) {
      const img = window.document.createElement('img');
      img.src = `/api/dataroom/documents/${documentId}/pages/${i}?w=2000`;
      const wrapper = window.document.createElement('div');
      wrapper.className = 'dataroom-print-page';
      wrapper.appendChild(img);
      host.appendChild(wrapper);
      // Sequential rather than parallel: a hundred simultaneous renders is how
      // one print request becomes an outage.
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
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
  }, [documentId]);

  useEffect(() => {
    registerPrinter?.(print);
  }, [registerPrinter, print]);

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Preparing a protected copy…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="p-12 text-center max-w-md">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-700 mb-2">
          This document cannot be displayed
        </h3>
        <p className="text-sm text-slate-600">{message}</p>
      </div>
    );
  }

  const pageNumber = Math.min(Math.max(1, page), info.numPages);
  const dims = info.pages?.[pageNumber - 1];
  const aspect = dims ? dims.height / dims.width : 1.414;

  return (
    <div className="inline-block" style={{ width: `${(zoom / 100) * 900}px`, maxWidth: '100%' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        // The key forces a fresh element per page and per width, so a slow
        // fetch for the page just left cannot land on the page just opened.
        key={`${pageNumber}-${width}`}
        src={`/api/dataroom/documents/${documentId}/pages/${pageNumber}?w=${width}`}
        alt={`Page ${pageNumber}`}
        width={dims?.width}
        height={dims?.height}
        // Reserving the box from the known aspect ratio stops the page jumping
        // when each image lands.
        style={{ aspectRatio: `1 / ${aspect}` }}
        className="block w-full h-auto bg-white select-none"
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
