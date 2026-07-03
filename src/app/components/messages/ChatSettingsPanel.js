'use client';

import { useState } from 'react';
import { X, Bell, BellOff, ShieldAlert } from 'lucide-react';
import ThemePicker from './ThemePicker';

const MUTE_OPTIONS = [
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '8h', label: '8 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: 'forever', label: 'Forever' },
];

// Generic per-conversation settings drawer shared by DM/Team/Group chat.
// `profile` = { avatarLabel, name, subtitleLines: string[] }
// `muteState` = { isMuted, mutedUntil, onSetMute(option) } — option is one of
//   MUTE_OPTIONS[].value or 'unmute'
// `dangerActions` = [{ label, icon, onClick }] (e.g. Block User, Leave Group)
// `extra` = optional extra JSX rendered below theme picker (e.g. member list)
export default function ChatSettingsPanel({
  open,
  onClose,
  title,
  profile,
  chatId,
  currentThemeId,
  onSelectTheme,
  muteState,
  dangerActions,
  extra,
}) {
  const [showMuteOptions, setShowMuteOptions] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {profile && (
            <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md mb-3">
                {profile.avatarLabel}
              </div>
              <h3 className="text-sm font-bold text-slate-900">{profile.name}</h3>
              {(profile.subtitleLines || []).map((line, i) => (
                <p key={i} className="text-xs text-slate-400 mt-0.5">{line}</p>
              ))}
            </div>
          )}

          {muteState && (
            <div>
              <button
                type="button"
                onClick={() => (muteState.isMuted ? muteState.onSetMute('unmute') : setShowMuteOptions(s => !s))}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-left"
              >
                {muteState.isMuted ? <BellOff className="w-4 h-4 text-rose-500" /> : <Bell className="w-4 h-4 text-slate-500" />}
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-800">{muteState.isMuted ? 'Muted' : 'Mute Notifications'}</p>
                  <p className="text-[10px] text-slate-400">
                    {muteState.isMuted ? 'Tap to unmute' : 'Silence notifications from this chat'}
                  </p>
                </div>
              </button>
              {showMuteOptions && !muteState.isMuted && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {MUTE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { muteState.onSetMute(opt.value); setShowMuteOptions(false); }}
                      className="px-3 py-2 text-[11px] font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {onSelectTheme && (
            <ThemePicker chatId={chatId} currentThemeId={currentThemeId} onSelect={onSelectTheme} />
          )}

          {extra}

          {dangerActions && dangerActions.length > 0 && (
            <div className="pt-4 border-t border-slate-100 space-y-2">
              {dangerActions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={action.onClick}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors font-semibold text-xs"
                >
                  {action.icon ? <action.icon className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
