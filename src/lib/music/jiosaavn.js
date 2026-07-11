// Isolated client for the (self-hosted) JioSaavnAPI instance — everything
// music-related lives under lib/music/ and api/status/music/ specifically so
// the whole feature can be deleted later by removing these two directories
// plus the few clearly-marked call sites in status settings/create routes.
//
// JioSaavnAPI is an unofficial scraper over JioSaavn's private API (see
// D:\Projects\JioSaavnAPI\CLAUDE.md) — unstable and unauthenticated. Treat
// every call as something that can fail, time out, or return garbage.

const REQUEST_TIMEOUT_MS = 8000;

export class MusicServiceError extends Error {}

export function isMusicConfigured() {
  return !!process.env.JIOSAAVN_API_URL;
}

export async function searchSongs(query) {
  const baseUrl = process.env.JIOSAAVN_API_URL;
  if (!baseUrl) {
    throw new MusicServiceError('Music search is not configured on this server.');
  }

  let response;
  try {
    response = await fetch(
      `${baseUrl.replace(/\/$/, '')}/song/?query=${encodeURIComponent(query)}&songdata=true&lyrics=false`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
    );
  } catch (err) {
    throw new MusicServiceError('Music search is temporarily unavailable.');
  }

  if (!response.ok) {
    throw new MusicServiceError('Music search is temporarily unavailable.');
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new MusicServiceError('Music search returned an unexpected response.');
  }

  if (!Array.isArray(data)) {
    // JioSaavnAPI returns {status:false, error:'...'} on failure instead of
    // an HTTP error status.
    if (data?.error) throw new MusicServiceError('Music search is temporarily unavailable.');
    return [];
  }

  return data
    // Some results are JioSaavn-Pro/DRM-gated ("disabled":"true", is_drm:1)
    // and their media_url won't actually play — filter them out rather than
    // surfacing a track that silently fails during playback.
    .filter((song) => song?.disabled !== 'true' && !song?.is_drm && song?.media_url)
    .map((song) => ({
      id: song.id,
      title: song.song || song.title || 'Unknown title',
      artist: song.singers || song.primary_artists || song.music || 'Unknown artist',
      album: song.album || null,
      thumbnail: song.image || null,
      durationSec: parseInt(song.duration, 10) || null,
      // Prefer the shorter preview clip over the full 320kbps track — this
      // is a status update, not a music player.
      streamUrl: song.media_preview_url || song.media_url,
    }));
}
