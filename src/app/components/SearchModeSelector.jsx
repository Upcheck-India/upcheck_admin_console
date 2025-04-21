'use client';

import { Globe, Database } from 'lucide-react';

export default function SearchModeSelector({ searchMode, onSearchModeChange }) {
  const handleModeClick = (mode) => {
    // If clicking the already selected mode, deselect it
    if (mode === searchMode) {
      onSearchModeChange(null);
    } else {
      onSearchModeChange(mode);
    }
  };

  return (
    <div className="flex items-center justify-center mb-2 sm:mb-4 gap-2 px-2 sm:px-4">
      <button
        onClick={() => handleModeClick('database')}
        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 text-sm sm:text-base ${
          searchMode === 'database'
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title="Search Official Database"
      >
        <Database className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="hidden sm:inline">Official DB</span>
      </button>
      <button
        onClick={() => handleModeClick('internet')}
        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 text-sm sm:text-base ${
          searchMode === 'internet'
            ? 'bg-gradient-to-r from-teal-600 to-green-600 text-white shadow-lg scale-105'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title="Search Internet"
      >
        <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="hidden sm:inline">Internet</span>
      </button>
    </div>
  );
}