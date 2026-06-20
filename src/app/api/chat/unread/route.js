import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    
    const currentUser = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const query = {
      recipientId: currentUser._id.toString(),
      status: { $ne: 'read' }
    };

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        query.createdAt = { $gt: sinceDate };
      }
    }

    const messages = await db.collection('chat_messages')
      .find(query)
      .sort({ createdAt: 1 })
      .toArray();

    const serialized = messages.map(m => ({
      ...m,
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
