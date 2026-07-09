import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';

// GET /api/changelogs/unseen — the single latest published, non-silent
// changelog the current user hasn't acknowledged yet (server-side
// seen-tracking, so it's consistent across the user's devices). Returns
// { changelog: null } if there's nothing new. The client decides how to
// present it based on its displayMode (banner/popup/forced/full_page) —
// 'silent' entries are excluded here entirely, so they never surface as an
// unprompted banner/popup; they're still visible in the full changelog
// history list (GET /api/changelogs), which doesn't filter by displayMode.
export async function GET(request) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = authData;
    const userId = user._id.toString();

    const recentPublished = await db.collection('changelogs')
      .find({ isPublished: true, displayMode: { $ne: 'silent' } })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    if (recentPublished.length === 0) {
      return NextResponse.json({ changelog: null });
    }

    const seenDocs = await db.collection('changelog_seen')
      .find({ userId, changelogId: { $in: recentPublished.map(c => c._id.toString()) } })
      .project({ changelogId: 1 })
      .toArray();
    const seenIds = new Set(seenDocs.map(d => d.changelogId));

    const latestUnseen = recentPublished.find(c => !seenIds.has(c._id.toString()));

    return NextResponse.json({ changelog: latestUnseen || null });
  } catch (error) {
    console.error('Error checking unseen changelogs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
