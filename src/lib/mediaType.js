// Shared media helpers for chat send routes. Kept in sync with the app's
// lib/mediaType.ts (isGifUrl) so both sides classify GIFs identically.

export function isGifUrl(url) {
  if (!url) return false;
  return /\.gif(\?|#|$)/i.test(url) || /giphy\.com/i.test(url);
}

// Fallback body for a captionless media message, so notifications and
// last-message previews aren't blank. The client suppresses these markers from
// rendering as a visible caption (see isAutoMediaCaption in the app).
export function mediaFallbackBody(mediaUrl) {
  if (!mediaUrl) return '';
  return isGifUrl(mediaUrl) ? '🎞️ GIF' : '📷 Photo';
}
