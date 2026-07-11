import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    const now = new Date();
    const statuses = await db.collection('status_updates')
      .find({ userId: currentUser._id.toString(), expiresAt: { $gt: now }, deletedAt: null })
      .sort({ createdAt: 1 })
      .toArray();

    if (statuses.length === 0) {
      return NextResponse.json({ success: true, statuses: [] });
    }

    const statusIds = statuses.map(s => s._id);
    const viewCounts = await db.collection('status_views')
      .aggregate([
        { $match: { statusId: { $in: statusIds } } },
        { $group: { _id: '$statusId', count: { $sum: 1 } } },
      ])
      .toArray();
    const viewCountMap = new Map(viewCounts.map(v => [v._id.toString(), v.count]));

    const reactionCounts = await db.collection('status_reactions')
      .aggregate([
        { $match: { statusId: { $in: statusIds } } },
        { $group: { _id: '$statusId', count: { $sum: 1 } } },
      ])
      .toArray();
    const reactionCountMap = new Map(reactionCounts.map(r => [r._id.toString(), r.count]));

    return NextResponse.json({
      success: true,
      statuses: statuses.map(s => ({
        _id: s._id.toString(),
        mediaUrl: s.mediaUrl,
        mediaType: s.mediaType,
        caption: s.caption,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        viewCount: viewCountMap.get(s._id.toString()) || 0,
        reactionCount: reactionCountMap.get(s._id.toString()) || 0,
      })),
    });
  } catch (err) {
    console.error('Status mine error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
