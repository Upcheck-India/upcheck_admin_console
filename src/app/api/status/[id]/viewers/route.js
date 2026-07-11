import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAuthUser } from '../../../../../lib/auth';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid status ID' }, { status: 400 });
    }

    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    const status = await db.collection('status_updates').findOne({ _id: new ObjectId(id) });
    if (!status) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (status.userId !== currentUser._id.toString()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [views, reactions] = await Promise.all([
      db.collection('status_views').find({ statusId: status._id }).sort({ viewedAt: -1 }).toArray(),
      db.collection('status_reactions').find({ statusId: status._id }).toArray(),
    ]);

    const viewerIds = views.map(v => new ObjectId(v.viewerId));
    const users = await db.collection('admin_users')
      .find({ _id: { $in: viewerIds } }, { projection: { _id: 1, username: 1, name: 1, avatar: 1 } })
      .toArray();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));
    const reactionMap = new Map(reactions.map(r => [r.userId, r.emoji]));

    return NextResponse.json({
      success: true,
      viewers: views.map(v => {
        const u = userMap.get(v.viewerId);
        return {
          id: v.viewerId,
          username: u?.username || 'Unknown',
          name: u?.name || 'Unknown',
          avatar: u?.avatar || null,
          viewedAt: v.viewedAt,
          reaction: reactionMap.get(v.viewerId) || null,
        };
      }),
    });
  } catch (err) {
    console.error('Status viewers error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
