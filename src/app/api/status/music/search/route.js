import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../lib/auth';
import { getStatusSettings } from '../../../../../lib/status/settings';
import { searchSongs, MusicServiceError } from '../../../../../lib/music/jiosaavn';

export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { db } = auth;

    // Checked (and reported) separately rather than one combined boolean —
    // "Music in status is disabled" was surfacing even when the real
    // blocker was the master Status switch being off, which sent admins
    // looking in the wrong place.
    const settings = await getStatusSettings(db);
    if (!settings.statusEnabled) {
      return NextResponse.json({ error: 'Status updates are currently disabled' }, { status: 403 });
    }
    if (!settings.musicEnabled) {
      return NextResponse.json({ error: 'Music in status is currently disabled' }, { status: 403 });
    }

    const query = new URL(request.url).searchParams.get('q')?.trim();
    if (!query) {
      return NextResponse.json({ error: 'q is required' }, { status: 400 });
    }

    const results = await searchSongs(query);
    return NextResponse.json({ success: true, results });
  } catch (err) {
    if (err instanceof MusicServiceError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('Music search error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
