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

    // Build viewerIds defensively — a malformed/legacy viewerId shouldn't
    // 500 the whole endpoint, it should just fail to resolve that one entry.
    const viewerIds = [];
    for (const v of views) {
      if (ObjectId.isValid(v.viewerId)) viewerIds.push(new ObjectId(v.viewerId));
    }
    const users = await db.collection('admin_users')
      .find({ _id: { $in: viewerIds } }, { projection: { _id: 1, username: 1, name: 1, email: 1, avatar: 1 } })
      .toArray();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));
    const reactionMap = new Map(reactions.map(r => [r.userId, r.emoji]));

    return NextResponse.json({
      success: true,
      viewers: views.map(v => {
        const u = userMap.get(v.viewerId);
        if (!u) {
          console.warn(`[status/viewers] no admin_users match for viewerId=${v.viewerId} on status=${id}`);
        }
        return {
          id: v.viewerId,
          username: u?.username || u?.email || 'Unknown user',
          name: u?.name || u?.username || u?.email || 'Unknown user',
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
