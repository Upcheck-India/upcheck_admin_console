import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;
    const userId = currentUser._id.toString();

    const body = await request.json().catch(() => ({}));
    const type = body.type || 'all'; // 'all' | 'dms' | 'teams' | 'groups'

    if (type === 'all' || type === 'dms') {
      // Mark all unread DM messages as read for this user
      await db.collection('chat_messages').updateMany(
        {
          recipientId: userId,
          status: { $ne: 'read' }
        },
        {
          $set: { status: 'read' }
        }
      );
    }

    if (type === 'all' || type === 'teams') {
      // Mark all unread Team messages as read for this user
      await db.collection('team_messages').updateMany(
        {
          'readBy.userId': { $ne: userId },
          senderId: { $ne: userId }
        },
        {
          $push: { readBy: { userId, readAt: new Date() } }
        }
      );
    }

    if (type === 'all' || type === 'groups') {
      // Mark all unread Group messages as read for this user
      await db.collection('group_chat_messages').updateMany(
        {
          'readBy.userId': { $ne: userId },
          senderId: { $ne: userId }
        },
        {
          $push: { readBy: { userId, readAt: new Date() } }
        }
      );
    }

    return NextResponse.json({ success: true, type });
  } catch (error) {
    console.error('Mark all read error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
