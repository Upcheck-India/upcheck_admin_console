'use client';

import { Check } from 'lucide-react';
import { CHAT_THEMES } from '../../utils/chatThemes';

// chatId must already be namespaced (e.g. `dm-${conversationId}`).
export default function ThemePicker({ chatId, currentThemeId, onSelect }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Chat Theme</h3>
      <div className="grid grid-cols-3 gap-3">
        {CHAT_THEMES.map(theme => {
          const isSelected = theme.id === currentThemeId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelect(chatId, theme.id)}
              className={`relative rounded-xl border-2 overflow-hidden text-left transition-all ${
                isSelected ? 'border-blue-500 shadow-md' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div style={{ background: theme.pageBg }} className="h-16 p-2 flex flex-col justify-end gap-1">
                <div style={{ background: theme.peerBubbleBg, border: `1px solid ${theme.peerBubbleBorder}` }} className="h-2.5 w-3/5 rounded-full" />
                <div style={{ background: theme.myBubbleBg }} className="h-2.5 w-2/5 rounded-full self-end" />
              </div>
              <div className="px-2 py-1.5 bg-white flex items-center gap-1">
                {isSelected && <Check className="w-3 h-3 text-blue-600 flex-shrink-0" />}
                <span className="text-[10px] font-semibold text-slate-700 truncate">{theme.name}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
