import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

async function getAuthUser(req) {
  const authHeader = req.headers.get('authorization');
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const cookieStore = cookies();
    token = cookieStore.get('admin_token')?.value;
  }
  if (!token) return null;
  const client = await clientPromise;
  const db = client.db('resources');
  return await db.collection('admin_users').findOne({ sessionToken: token });
}

export async function POST(req, { params }) {
  try {
    const { id: groupId, messageId } = params;
    if (!ObjectId.isValid(groupId) || !ObjectId.isValid(messageId)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const client = await clientPromise;
    const db = client.db('resources');
    const username = user.username || 'System';

    const { isPinned, duration } = await req.json();

    const message = await db.collection('group_chat_messages').findOne({
      _id: new ObjectId(messageId),
      groupId
    });

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
      updatedAt: new Date() // Force real-time update
    };

    await db.collection('group_chat_messages').updateOne(
      { _id: new ObjectId(messageId) },
      { $set: updateDoc }
    );

    return NextResponse.json({ success: true, pinned: !!isPinned, pinExpiresAt });
  } catch (err) {
    console.error('Group pin error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
