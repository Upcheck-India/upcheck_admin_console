import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../lib/auth';
import { isMusicStatusEnabled } from '../../../../../lib/status/settings';
import { searchSongs, MusicServiceError } from '../../../../../lib/music/jiosaavn';

export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { db } = auth;

    if (!(await isMusicStatusEnabled(db))) {
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
