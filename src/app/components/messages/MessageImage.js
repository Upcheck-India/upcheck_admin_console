'use client';

import { useState } from 'react';
import { ImageOff, Download, X } from 'lucide-react';

// Renders an image message bubble with a click-to-expand lightbox, and a
// safe "Photo unavailable" fallback instead of a broken image icon or,
// worse, a fully blank bubble (the class of bug already fixed server-side
// for the persisted message body — this is the client-side counterpart).
export default function MessageImage({ src, alt = 'Shared image', caption }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-56 h-40 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400">
        <ImageOff className="w-6 h-6 mb-1.5" />
        <span className="text-[10px] font-medium">Photo unavailable</span>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          onClick={() => setOpen(true)}
          className="max-w-[280px] max-h-64 object-cover cursor-pointer hover:opacity-95 transition-opacity"
        />
        {caption && <p className="text-sm px-1 pt-1.5 whitespace-pre-wrap break-words">{caption}</p>}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-6"
          onClick={() => setOpen(false)}
        >
          <button
            className="absolute top-5 right-5 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            onClick={() => setOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
          <a
            href={src}
            download
            onClick={(e) => e.stopPropagation()}
            className="absolute top-5 right-16 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </a>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
