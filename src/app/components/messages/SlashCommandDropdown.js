'use client';

import { Terminal, Loader } from 'lucide-react';

// Autocomplete dropdown shown above the composer while the user is typing
// a "/" slash command — lists installed plugins' commands filtered by the
// typed prefix (fetched once per chat via useSlashCommandAutocomplete).
export default function SlashCommandDropdown({ loading, commands, onSelect }) {
  if (loading) {
    return (
      <div className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-40">
        <div className="flex items-center justify-center py-4">
          <Loader className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (commands.length === 0) {
    return (
      <div className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-40">
        <p className="text-xs text-slate-400">No matching commands. This chat may not have any plugins installed.</p>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-40 max-h-64 overflow-y-auto">
      {commands.map(cmd => (
        <button
          key={cmd.name}
          type="button"
          onClick={() => onSelect(cmd)}
          className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
        >
          <Terminal className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 font-mono">{cmd.usage}</span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">{cmd.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
