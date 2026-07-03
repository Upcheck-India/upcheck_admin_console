// Shared #task-mention composer logic for the web console (DM/Team/Group
// chat pages). The wire format is `#[<24-hex taskId>:<title>]`, matching
// the existing `#[Title]`/`@[Role]`/`@{Team}` bracketed-mention convention
// already used elsewhere in this app (see project_management/ProjectChat.js)
// — but with a real, resolvable id instead of matching by title text.

export const TASK_MENTION_REGEX = /#\[([a-f0-9]{24}):([^\]]+)\]/;
export const TASK_MENTION_REGEX_G = /(#\[[a-f0-9]{24}:[^\]]+\])/g;

// Detects whether the cursor is currently inside an in-progress "#query"
// the user is typing, so an autocomplete dropdown can be shown. Mirrors the
// mobile app's existing `@` mention detection (tolerates up to one space,
// so multi-word search-as-you-type works, but bails once it looks like the
// user has moved on to a new sentence).
export function detectHashTrigger(text, cursorPos) {
  const before = text.substring(0, cursorPos);
  const idx = before.lastIndexOf('#');
  if (idx === -1) return null;
  const candidate = before.substring(idx + 1);
  const spaceCount = (candidate.match(/\s/g) || []).length;
  if (spaceCount > 1 || candidate.includes('\n') || candidate.includes('[')) return null;
  return { idx, query: candidate };
}

export function insertTaskMentionToken(text, cursorPos, task) {
  const before = text.substring(0, cursorPos);
  const after = text.substring(cursorPos);
  const idx = before.lastIndexOf('#');
  const prefix = before.substring(0, idx);
  const token = `#[${task._id}:${task.title}] `;
  return { newText: prefix + token + after, newCursor: (prefix + token).length };
}
