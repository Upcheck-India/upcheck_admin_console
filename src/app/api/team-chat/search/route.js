import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId');
    const keyword = searchParams.get('keyword');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    }

    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { db } = auth;

    const query = {
      teamId,
      body: { $regex: keyword || '', $options: 'i' }
    };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const messages = await db.collection('team_messages')
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
    console.error('Search Team messages error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
