'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Globe,
  Database,
  Mail,
  Code,
  Wrench,
  X
} from 'lucide-react';

const tools = [
  {
    id: 'internet',
    name: 'Search Internet',
    description: 'Search the web for information',
    icon: Globe,
    badge: 'Requested Internet Search'
  },
  {
    id: 'database',
    name: 'Search Official DB',
    description: 'Search Upcheck\'s database',
    icon: Database,
    badge: 'Requested DB Search'
  },
  {
    id: 'code',
    name: 'Code Assistant',
    description: 'Help with coding tasks',
    icon: Code,
    badge: 'Requested Code Help',
    comingSoon: true
  },
  {
    id: 'email',
    name: 'Email Assistant',
    description: 'Help with composing emails',
    icon: Mail,
    badge: 'Requested Email Service',
    comingSoon: true
  }
];

export default function ToolSelector({ selectedTool, onToolChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToolClick = (toolId) => {
    if (toolId === selectedTool) {
      onToolChange(null); // Deselect if clicking the same tool
    } else {
      onToolChange(toolId);
    }
    setIsOpen(false);
  };

  const selectedToolData = tools.find(tool => tool.id === selectedTool);

  return (
    <div className="relative self-end" ref={menuRef}>
      {/* Dropdown Menu - Positioned Above */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 sm:w-64 mb-2 py-2 bg-white rounded-lg shadow-xl border border-gray-100 z-50">
          <div className="max-h-[min(400px,60vh)] overflow-y-auto">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => !tool.comingSoon && handleToolClick(tool.id)}
                className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors relative ${
                  tool.comingSoon ? 'opacity-50 cursor-not-allowed' : ''
                } ${selectedTool === tool.id ? 'bg-blue-50' : ''}`}
              >
                <tool.icon className={`w-5 h-5 mt-0.5 ${
                  selectedTool === tool.id ? 'text-blue-500' : 'text-gray-500'
                }`} />
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{tool.name}</span>
                    {tool.comingSoon && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full sm:w-auto px-4 py-2 rounded-lg flex items-center justify-between gap-2 transition-all ${
          isOpen || selectedTool
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4" />
          <span className="text-sm font-medium">
            {selectedToolData ? selectedToolData.name : 'Tools'}
          </span>
        </div>
        {selectedTool ? (
          <X 
            className="w-4 h-4 hover:rotate-90 transition-transform" 
            onClick={(e) => {
              e.stopPropagation();
              onToolChange(null);
            }}
          />
        ) : (
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>
    </div>
  );
}

// Export tools info for use in other components
export const getToolBadge = (toolId) => {
  const tool = tools.find(t => t.id === toolId);
  return tool?.badge;
};