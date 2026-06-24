import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const { peerId, block } = await request.json();
    
    if (!peerId) {
      return NextResponse.json({ error: 'Peer ID required' }, { status: 400 });
    }

    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

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
