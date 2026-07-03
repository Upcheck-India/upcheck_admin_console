// Mirrors the mobile app's lib/typingText.ts wording exactly, so "who's
// typing" reads the same on web and mobile.
export function formatTypingText(users) {
  if (!users || users.length === 0) return '';
  const names = users.map(u => u.name || u.username || 'Someone');
  if (names.length === 1) return `${names[0]} is typing...`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
  return 'Several people are typing...';
}
