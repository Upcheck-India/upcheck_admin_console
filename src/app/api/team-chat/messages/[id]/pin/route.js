import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(req, { params }) {
  try {
    const messageId = params.id;
    if (!ObjectId.isValid(messageId)) {
      return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 });
    }

    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;
    const username = currentUser.username || 'System';

    const { isPinned, duration } = await req.json();

    const message = await db.collection('team_messages').findOne({ _id: new ObjectId(messageId) });
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    let pinExpiresAt = null;
    if (isPinned && duration && duration !== 'unlimited') {
      const now = Date.now();
      if (duration === '24h') pinExpiresAt = new Date(now + 24 * 60 * 60 * 1000);
      else if (duration === '7d') pinExpiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
      else if (duration === '30d') pinExpiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000);
    }

    const updateDoc = {
      pinned: !!isPinned,
      pinnedAt: isPinned ? new Date() : null,
      pinnedBy: isPinned ? username : null,
      pinExpiresAt: isPinned ? pinExpiresAt : null,
      updatedAt: new Date() // Force real-time updates
    };

    await db.collection('team_messages').updateOne(
      { _id: new ObjectId(messageId) },
      { $set: updateDoc }
    );

    return NextResponse.json({ success: true, pinned: !!isPinned, pinExpiresAt });
  } catch (err) {
    console.error('Team pin error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
