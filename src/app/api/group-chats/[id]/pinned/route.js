import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
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

export async function GET(req, { params }) {
  try {
    const groupId = params.id;
    if (!ObjectId.isValid(groupId)) {
      return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const client = await clientPromise;
    const db = client.db('resources');

    const now = new Date();
    const pinnedMessages = await db.collection('group_chat_messages')
      .find({
        groupId,
        pinned: true,
        $or: [
          { pinExpiresAt: null },
          { pinExpiresAt: { $gt: now } }
        ]
      })
      .sort({ pinnedAt: -1 })
      .toArray();

    // Map sender names
    const senderIds = [...new Set(pinnedMessages.map(m => m.senderId).filter(Boolean))];
    const senders = await db.collection('admin_users')
      .find({ _id: { $in: senderIds.map(id => new ObjectId(id)) } })
      .toArray();
    const senderMap = senders.reduce((acc, u) => {
      acc[u._id.toString()] = u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username;
      return acc;
    }, {});

    const serialized = pinnedMessages.map(m => ({
      ...m,
      _id: m._id.toString(),
      senderName: senderMap[m.senderId] || 'Member'
    }));

    return NextResponse.json({ pinnedMessages: serialized });
  } catch (err) {
    console.error('Fetch Group pinned messages error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
