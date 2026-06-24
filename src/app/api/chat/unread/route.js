import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    const query = {
      recipientId: currentUser._id.toString(),
      status: { $ne: 'read' }
    };

    if (since) {
      // searchParams.get() automatically decodes the URL component
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        query.createdAt = { $gt: sinceDate };
      }
    }

    const messages = await db.collection('chat_messages')
      .find(query)
      .sort({ createdAt: 1 })
      .toArray();

    // Look up sender details to avoid 'Unknown User'
    const senderIds = [...new Set(messages.map(m => m.senderId))].filter(Boolean);
    let senderMap = {};
    if (senderIds.length > 0) {
      const senders = await db.collection('admin_users')
        .find({ _id: { $in: senderIds.map(id => new ObjectId(id)) } })
        .project({ username: 1 })
        .toArray();
        
      senderMap = senders.reduce((acc, user) => {
        acc[user._id.toString()] = user.username;
        return acc;
      }, {});
    }

    const serialized = messages.map(m => ({
      ...m,
      senderName: senderMap[m.senderId] || 'Unknown User',
      _id: m._id.toString()
    }));

    return NextResponse.json({
      messages: serialized,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    console.error('Unread messages error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
