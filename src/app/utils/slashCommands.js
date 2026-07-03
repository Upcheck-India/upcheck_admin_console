// Slash commands are whole-message commands (mirrors SLASH_COMMAND_RE in
// src/lib/plugins/dispatch.js) — they only trigger when "/" is the very
// first character of the composer, unlike "@"/"#" mentions which can
// appear anywhere in the text.
export function detectSlashTrigger(text) {
  if (!text.startsWith('/')) return null;
  const rest = text.slice(1);
  if (rest.includes('\n') || rest.includes(' ')) return null;
  return { query: rest };
}
