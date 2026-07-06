import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
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

    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get('keyword');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { db } = auth;

    const query = {
      groupId,
      body: { $regex: keyword || '', $options: 'i' }
    };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const messages = await db.collection('group_chat_messages')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    // Map sender names
    const senderIds = [...new Set(messages.map(m => m.senderId).filter(Boolean))];
    const senders = await db.collection('admin_users')
      .find({ _id: { $in: senderIds.map(id => new ObjectId(id)) } })
      .toArray();
    const senderMap = senders.reduce((acc, u) => {
      acc[u._id.toString()] = u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username;
      return acc;
    }, {});

    const serialized = messages.map(m => ({
      ...m,
      _id: m._id.toString(),
      senderName: senderMap[m.senderId] || 'Member'
    }));

    return NextResponse.json({ messages: serialized });
  } catch (err) {
    console.error('Search Group messages error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
