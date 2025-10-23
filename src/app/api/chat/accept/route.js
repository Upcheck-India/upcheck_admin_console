import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';

export async function POST(request) {
  try {
    const { peerId } = await request.json();
    
    if (!peerId) {
      return NextResponse.json({ error: 'Peer ID required' }, { status: 400 });
    }

    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    
    const currentUser = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Update both sides to accepted
    const receiverUpdate = await db.collection('chat_connections').updateOne(
      {
        userId: currentUser._id.toString(),
        peerId: peerId,
        status: 'pending'
      },
      {
        $set: {
          status: 'accepted',
          updatedAt: new Date()
        }
      }
    );

    const senderUpdate = await db.collection('chat_connections').updateOne(
      {
        userId: peerId,
        peerId: currentUser._id.toString(),
        status: 'pending'
      },
      {
        $set: {
          status: 'accepted',
          updatedAt: new Date()
        }
      }
    );

    if (receiverUpdate.matchedCount === 0) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Accept error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
