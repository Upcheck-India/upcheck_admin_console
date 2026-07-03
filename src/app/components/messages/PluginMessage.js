'use client';

import MessageBody from './MessageBody';
import { formatMessageTime } from '../../utils/timeFormat';
import { PLUGIN_SENDER_NAME } from '../../utils/pluginSender';

// Distinct bubble for deterministic chat-plugin output (slash command
// responses) — visually separate from a human "peer" message so it reads
// as "the Project Management plugin replied", not as a message from
// whichever human happens to be on the other side of the chat. Labeled
// with the actual plugin's name/icon (stored per-message) rather than a
// generic "Upcheck Plugins" tag, so replies from different plugins
// (Project Management, Meetings, Moderation, ...) are visually distinct.
export default function PluginMessage({ text, createdAt, timeFormat, onTaskClick, pluginName, pluginIcon }) {
  const label = pluginName || PLUGIN_SENDER_NAME;
  const icon = pluginIcon || '🔌';

  return (
    <div className="flex justify-start mb-3">
      <div className="flex items-end gap-2.5 max-w-[80%]">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-sm flex-shrink-0 shadow-sm">
          {icon}
        </div>
        <div className="flex flex-col items-start min-w-0">
          <span className="text-[10px] text-amber-600 font-bold mb-1 ml-1">{label}</span>
          <div className="relative px-4 py-3 rounded-2xl rounded-bl-sm border border-amber-200 bg-amber-50 shadow-sm">
            <MessageBody
              text={text}
              onTaskClick={onTaskClick}
              className="text-[13px] whitespace-pre-wrap break-words leading-[1.6] text-amber-950 select-text"
            />
            {createdAt && (
              <div className="flex items-center justify-end mt-1.5 -mb-1">
                <span className="text-[9px] font-semibold tracking-wide text-amber-500">
                  {formatMessageTime(createdAt, timeFormat)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
