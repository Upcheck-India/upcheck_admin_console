import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';

export async function POST(request) {
  try {
    const { peerId, block } = await request.json();
    
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

    const newStatus = block ? 'blocked' : 'revoked';

    // Update both connections
    await db.collection('chat_connections').updateMany(
      {
        $or: [
          { userId: currentUser._id.toString(), peerId: peerId },
          { userId: peerId, peerId: currentUser._id.toString() }
        ]
      },
      {
        $set: {
          status: newStatus,
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('Revoke error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
