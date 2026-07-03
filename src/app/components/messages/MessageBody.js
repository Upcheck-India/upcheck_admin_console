'use client';

import { Bookmark } from 'lucide-react';
import { TASK_MENTION_REGEX } from '../../utils/taskMentions';

const SEGMENT_REGEX = /(\*\*.*?\*\*|\*.*?\*|`.*?`|@[a-zA-Z0-9_]+|#\[[a-f0-9]{24}:[^\]]+\])/g;

// Shared message-body renderer for DM/Team/Group chat (web console).
// Handles **bold**, *italic*, `code`, @mentions, and #task mentions
// (rendered as a clickable chip) — one implementation instead of the
// previously-duplicated per-page formatText functions (and DM previously
// had none of this at all).
export default function MessageBody({ text, onTaskClick, className }) {
  if (!text) return null;
  const parts = text.split(SEGMENT_REGEX);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={index}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={index} className="bg-slate-100 px-1 rounded font-mono text-sm">{part.slice(1, -1)}</code>;
        }
        const taskMatch = part.match(TASK_MENTION_REGEX);
        if (taskMatch) {
          const [, taskId, title] = taskMatch;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onTaskClick?.(taskId)}
              className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors align-middle"
            >
              <Bookmark className="w-3 h-3" /> {title}
            </button>
          );
        }
        if (part.startsWith('@')) {
          return <span key={index} className="text-blue-500 font-bold">{part}</span>;
        }
        return part;
      })}
    </span>
  );
}
