// Per-conversation chat theme registry for the web console, mirroring the
// mobile app's lib/themes system. Web renders with inline style values
// (not Tailwind classes) so themes can be swapped at runtime without
// needing every color to be a build-time-known Tailwind class.

export const CHAT_THEMES = [
  {
    id: 'default',
    name: 'Default Blue',
    pageBg: 'linear-gradient(to bottom, #f8fafc, #f1f5f9)',
    headerBg: 'rgba(255,255,255,0.95)',
    myBubbleBg: 'linear-gradient(135deg, #2563eb, #4f46e5)',
    myBubbleText: '#ffffff',
    peerBubbleBg: '#ffffff',
    peerBubbleText: '#1e293b',
    peerBubbleBorder: '#e2e8f0',
    accent: '#2563eb',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    pageBg: 'linear-gradient(to bottom, #0f172a, #1e293b)',
    headerBg: 'rgba(15,23,42,0.95)',
    myBubbleBg: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    myBubbleText: '#ffffff',
    peerBubbleBg: '#1e293b',
    peerBubbleText: '#e2e8f0',
    peerBubbleBorder: '#334155',
    accent: '#60a5fa',
  },
  {
    id: 'forest',
    name: 'Forest',
    pageBg: 'linear-gradient(to bottom, #f0fdf4, #ecfdf5)',
    headerBg: 'rgba(255,255,255,0.95)',
    myBubbleBg: 'linear-gradient(135deg, #059669, #10b981)',
    myBubbleText: '#ffffff',
    peerBubbleBg: '#ffffff',
    peerBubbleText: '#1e293b',
    peerBubbleBorder: '#d1fae5',
    accent: '#059669',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    pageBg: 'linear-gradient(to bottom, #fff7ed, #fef2f2)',
    headerBg: 'rgba(255,255,255,0.95)',
    myBubbleBg: 'linear-gradient(135deg, #ea580c, #dc2626)',
    myBubbleText: '#ffffff',
    peerBubbleBg: '#ffffff',
    peerBubbleText: '#1e293b',
    peerBubbleBorder: '#fed7aa',
    accent: '#ea580c',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    pageBg: 'linear-gradient(to bottom, #ecfeff, #f0f9ff)',
    headerBg: 'rgba(255,255,255,0.95)',
    myBubbleBg: 'linear-gradient(135deg, #0891b2, #0284c7)',
    myBubbleText: '#ffffff',
    peerBubbleBg: '#ffffff',
    peerBubbleText: '#1e293b',
    peerBubbleBorder: '#cffafe',
    accent: '#0891b2',
  },
  {
    id: 'grape',
    name: 'Grape',
    pageBg: 'linear-gradient(to bottom, #faf5ff, #fdf4ff)',
    headerBg: 'rgba(255,255,255,0.95)',
    myBubbleBg: 'linear-gradient(135deg, #7c3aed, #a21caf)',
    myBubbleText: '#ffffff',
    peerBubbleBg: '#ffffff',
    peerBubbleText: '#1e293b',
    peerBubbleBorder: '#f3e8ff',
    accent: '#7c3aed',
  },
];

export const DEFAULT_CHAT_THEME = CHAT_THEMES[0];

export function getChatThemeById(id) {
  return CHAT_THEMES.find(t => t.id === id) || DEFAULT_CHAT_THEME;
}

// chatId should already be namespaced by the caller, e.g. `dm-${conversationId}`,
// `team-${teamId}`, `group-${groupId}` — matching the mobile app's SecureStore
// key convention so the two systems are conceptually consistent (they are
// separate storage backends — localStorage here vs SecureStore on mobile —
// but the same per-conversation key shape makes the mental model transferable).
export function getChatTheme(chatId) {
  if (typeof window === 'undefined') return DEFAULT_CHAT_THEME;
  try {
    const savedId = localStorage.getItem(`theme_${chatId}`);
    return savedId ? getChatThemeById(savedId) : DEFAULT_CHAT_THEME;
  } catch {
    return DEFAULT_CHAT_THEME;
  }
}

export function setChatTheme(chatId, themeId) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`theme_${chatId}`, themeId);
  } catch {
    // ignore storage errors (e.g. private browsing quota)
  }
}
