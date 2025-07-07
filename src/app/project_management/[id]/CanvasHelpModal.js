'use client';
import React from 'react';
import { HelpCircle, X, StickyNote, Users, Clock } from 'lucide-react';

const CanvasHelpModal = ({ open = false, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white max-w-lg w-full rounded-lg shadow-xl p-6 relative animate-fade-in">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <HelpCircle className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">About the Idea Canvas</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close help modal"
            className="text-gray-500 hover:text-gray-800"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-gray-700">
          <p>
            The <strong>Idea Canvas</strong> is a shared notepad for jotting down ideas, reminders, or future plans related
            to your project. Each project has one <em>Super Canvas</em>, and every sprint can have its own canvas as well.
          </p>

          <section>
            <h3 className="font-semibold text-gray-900 mb-1 flex items-center">
              <StickyNote className="h-4 w-4 mr-1 text-blue-600" /> Key Features
            </h3>
            <ul className="list-disc ml-5 space-y-1">
              <li>Rich-text editing with auto-save every few seconds.</li>
              <li>Manual save (Ctrl/⌘+S) and cancel (Esc) shortcuts.</li>
              <li>Character &amp; line counters, unsaved-changes indicator.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-1 flex items-center">
              <Users className="h-4 w-4 mr-1 text-blue-600" /> Who can edit?
            </h3>
            <ul className="list-disc ml-5 space-y-1">
              <li><strong>Super Manager</strong> – full editing rights.</li>
              <li><strong>Project Managers</strong> – can edit both super &amp; sprint canvases.</li>
              <li>Other members – read-only access.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-1 flex items-center">
              <Clock className="h-4 w-4 mr-1 text-blue-600" /> Version &amp; History
            </h3>
            <p>
              Every save stores the latest content with a timestamp. More advanced version history may be added in the future.
            </p>
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default CanvasHelpModal;
