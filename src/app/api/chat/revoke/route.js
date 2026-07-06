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

    if (block) {
      const myDoc = await db.collection('chat_connections').findOne({ userId: currentUser._id.toString(), peerId });
      const theirDoc = await db.collection('chat_connections').findOne({ userId: peerId, peerId: currentUser._id.toString() });

      await db.collection('chat_connections').updateOne(
        { userId: currentUser._id.toString(), peerId },
        {
          $set: {
            status: 'blocked',
            blockedBy: currentUser._id.toString(),
            prevStatus: myDoc?.status || 'accepted',
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      await db.collection('chat_connections').updateOne(
        { userId: peerId, peerId: currentUser._id.toString() },
        {
          $set: {
            status: 'blocked',
            blockedBy: currentUser._id.toString(),
            prevStatus: theirDoc?.status || 'accepted',
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
    } else {
      const myDoc = await db.collection('chat_connections').findOne({ userId: currentUser._id.toString(), peerId });
      if (myDoc && myDoc.status === 'blocked' && myDoc.blockedBy && myDoc.blockedBy !== currentUser._id.toString()) {
        return NextResponse.json({ error: 'Only the blocker can unblock.' }, { status: 403 });
      }

      await db.collection('chat_connections').updateMany(
        {
          $or: [
            { userId: currentUser._id.toString(), peerId: peerId },
            { userId: peerId, peerId: currentUser._id.toString() }
          ]
        },
        {
          $set: {
            status: 'revoked',
            updatedAt: new Date()
          },
          $unset: {
            blockedBy: "",
            prevStatus: ""
          }
        }
      );
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('Revoke error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
