import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { sendPushNotification } from '../../../../lib/pushNotifications';

export async function POST(request) {
  try {
    const { peerId } = await request.json();
    
    if (!peerId) {
      return NextResponse.json({ error: 'Peer ID required' }, { status: 400 });
    }

    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

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

    // Send push notification to peerId (the original requester)
    await sendPushNotification(
      peerId,
      'Chat Request Accepted',
      `${currentUser.name || currentUser.username} accepted your connection request.`,
      { type: 'chat_accept', peerId: currentUser._id.toString() }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Accept error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
