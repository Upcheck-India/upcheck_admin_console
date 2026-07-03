'use client';

import { Puzzle } from 'lucide-react';
import MessageBody from './MessageBody';
import { formatMessageTime } from '../../utils/timeFormat';
import { PLUGIN_SENDER_NAME } from '../../utils/pluginSender';

// Distinct bubble for deterministic chat-plugin output (slash command
// responses) — visually separate from a human "peer" message so it reads
// as "the Project Management plugin replied", not as a message from
// whichever human happens to be on the other side of the chat.
export default function PluginMessage({ text, createdAt, timeFormat, onTaskClick }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="flex items-end gap-2.5 max-w-[75%]">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
          <Puzzle className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-amber-600 font-bold mb-1 ml-1">{PLUGIN_SENDER_NAME}</span>
          <div className="relative px-4 py-2.5 rounded-2xl rounded-bl-sm border border-amber-200 bg-amber-50 shadow-sm">
            <MessageBody
              text={text}
              onTaskClick={onTaskClick}
              className="text-sm whitespace-pre-wrap break-words leading-relaxed text-amber-900 select-text"
            />
            {createdAt && (
              <div className="flex items-center justify-end mt-1 -mb-1">
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
