import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAuthUser } from '../../../../lib/auth';
import { filterOwnersVisibleTo } from '../../../../lib/status/privacy';

const BOT_ID = '600000000000000000000001';

// Status visibility is scoped to your accepted DM connections — the same
// set of people you can already message — rather than inventing a separate
// contacts/visibility model. Within that base set, each owner's own privacy
// setting further narrows who actually sees their updates.
export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    const connections = await db.collection('chat_connections')
      .find({ userId: currentUser._id.toString(), status: 'accepted', peerId: { $ne: BOT_ID } })
      .toArray();
    let peerIds = connections.map(c => c.peerId);

    if (peerIds.length === 0) {
      return NextResponse.json({ success: true, feed: [] });
    }

    peerIds = await filterOwnersVisibleTo(db, currentUser._id.toString(), peerIds);
    if (peerIds.length === 0) {
      return NextResponse.json({ success: true, feed: [] });
    }

    const now = new Date();
    const statuses = await db.collection('status_updates')
      .find({ userId: { $in: peerIds }, expiresAt: { $gt: now }, deletedAt: null })
      .sort({ createdAt: 1 })
      .toArray();

    if (statuses.length === 0) {
      return NextResponse.json({ success: true, feed: [] });
    }

    const statusIds = statuses.map(s => s._id);
    const myViews = await db.collection('status_views')
      .find({ viewerId: currentUser._id.toString(), statusId: { $in: statusIds } })
      .toArray();
    const viewedSet = new Set(myViews.map(v => v.statusId.toString()));

    const peers = await db.collection('admin_users')
      .find({ _id: { $in: peerIds.map(id => new ObjectId(id)) } }, { projection: { _id: 1, username: 1, name: 1, avatar: 1 } })
      .toArray();
    const peerMap = new Map(peers.map(p => [p._id.toString(), p]));

    const byUser = new Map();
    for (const s of statuses) {
      if (!byUser.has(s.userId)) byUser.set(s.userId, []);
      byUser.get(s.userId).push({
        _id: s._id.toString(),
        mediaUrl: s.mediaUrl,
        mediaType: s.mediaType,
        music: s.music || null,
        caption: s.caption,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        seen: viewedSet.has(s._id.toString()),
      });
    }

    const feed = Array.from(byUser.entries()).map(([userId, items]) => {
      const peer = peerMap.get(userId);
      const hasUnseen = items.some(i => !i.seen);
      const latestAt = items[items.length - 1].createdAt;
      return {
        user: peer ? {
          id: peer._id.toString(),
          username: peer.username,
          name: peer.name,
          avatar: peer.avatar || null,
        } : { id: userId, username: 'Unknown', name: 'Unknown', avatar: null },
        statuses: items,
        hasUnseen,
        latestAt,
      };
    });

    feed.sort((a, b) => {
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return new Date(b.latestAt) - new Date(a.latestAt);
    });

    return NextResponse.json({ success: true, feed });
  } catch (err) {
    console.error('Status feed error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
