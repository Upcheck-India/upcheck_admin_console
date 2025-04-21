'use client';

import { Sparkles, X } from 'lucide-react';

const updates = [
  {
    title: "Enhanced Message Processing",
    description: "Jovan is now less likely to encounter failed message processing, making conversations more reliable.",
    icon: "🛠️"
  },
  {
    title: "Code Block Improvements",
    description: "Support for medium-sized code blocks with automatic language detection and syntax highlighting.",
    icon: "💻"
  },
  {
    title: "Language Recognition",
    description: "Automatically detects programming languages in code blocks from markdown-style tags like ```python or ```javascript.",
    icon: "🔍"
  },
  {
    title: "Smart Response Formatting",
    description: "Better handling of mixed content responses with both text and code blocks.",
    icon: "✨"
  }
];

export default function WhatsNew({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              What&apos;s New in Jovan AI
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
            {updates.map((update, index) => (
              <div key={index} className="flex gap-4">
                <div className="text-2xl flex-shrink-0">{update.icon}</div>
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-1">
                    {update.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {update.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <p className="text-sm text-gray-500 text-center">
            More exciting features coming soon! 🚀
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}