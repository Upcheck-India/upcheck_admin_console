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
    // Every result from this API now comes back flagged "disabled":"true",
    // "is_drm":1 — verified this does NOT actually block playback (helper.py
    // decrypts the same encrypted_media_url regardless of this flag, and the
    // resulting stream URL returns a real, range-fetchable 200 in practice).
    // It's just JioSaavn's own app-side "Pro" paywall UI hint, not a signal
    // this scraper's decrypted URL is unplayable — filtering on it excluded
    // literally every search result. Only require an actual media_url.
    .filter((song) => !!song?.media_url)
    .map((song) => ({
      id: song.id,
      title: song.song || song.title || 'Unknown title',
      artist: song.singers || song.primary_artists || song.music || 'Unknown artist',
      album: song.album || null,
      thumbnail: song.image || null,
      durationSec: parseInt(song.duration, 10) || null,
      // The full track, not media_preview_url — the preview CDN 429'd under
      // light testing and, since our own clip trim always seeks + plays only
      // a chosen 30s window (range-fetched, not a full download), there's no
      // benefit to the shorter preview file anyway.
      streamUrl: song.media_url,
    }));
}
