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
    <div className="flex items-center justify-center mb-4 gap-2 px-4">
      <button
        onClick={() => handleModeClick('database')}
        className={`flex items-center hover:bg-blue-400 bg-blue-300 text-gray-400 gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
          searchMode === 'database'
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title="Search Official Database"
      >
        <Database className="w-5 h-5" />
        <span className="hidden sm:inline">Search Official DB</span>
      </button>
      <button
        onClick={() => handleModeClick('internet')}
        className={`flex items-center gap-2 hover:bg-green-400 bg-green-300 text-gray-400 px-4 py-2 rounded-lg transition-all duration-200 ${
          searchMode === 'internet'
            ? 'bg-gradient-to-r from-teal-600 to-green-600 text-white shadow-lg scale-105'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title="Search Internet"
      >
        <Globe className="w-5 h-5" />
        <span className="hidden sm:inline"> Search Internet</span>
      </button>
    </div>
  );
}