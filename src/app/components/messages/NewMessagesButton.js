'use client';

import { ArrowDown } from 'lucide-react';

export default function NewMessagesButton({ count, onClick }) {
  if (!count) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-full shadow-lg hover:bg-blue-700 transition-all active:scale-95"
    >
      {count} new message{count > 1 ? 's' : ''}
      <ArrowDown className="w-3.5 h-3.5" />
    </button>
  );
}
