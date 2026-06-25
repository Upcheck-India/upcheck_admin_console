import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
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

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get('groupId');
    const since = searchParams.get('since');

    if (!groupId) {
      return NextResponse.json({ error: 'Group ID required' }, { status: 400 });
    }

    if (!ObjectId.isValid(groupId)) {
      return NextResponse.json({ error: 'Invalid Group ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    let userRole = req.headers.get('x-user-role');
    let userId = req.headers.get('x-user-id');

    if (!userRole || !userId) {
      const authUser = await getAuthUser(req);
      if (authUser) {
        userRole = authUser.role;
        userId = authUser._id.toString();
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serverTimestamp = new Date().toISOString();
    let newMessages = [];

    if (since && since !== 'null') {
      const sinceDate = new Date(since);
      
      // Update read status for new messages since last poll
      await db.collection('group_chat_messages').updateMany(
        {
          groupId,
          senderId: { $ne: userId },
          createdAt: { $gt: sinceDate },
          'readBy.userId': { $ne: userId }
        },
        {
          $push: { readBy: { userId, readAt: new Date() } }
        }
      );

      const msgs = await db.collection('group_chat_messages')
        .find({
          groupId,
          createdAt: { $gt: sinceDate },
          deletedForEveryone: { $ne: true },
          deletedFor: { $ne: userId }
        })
        .sort({ createdAt: -1 })
        .toArray();

      if (msgs.length > 0) {
        // Fetch user details for these messages
        const userIds = [...new Set(msgs.map(m => m.senderId))];
        const userIdsObj = userIds.map(id => {
          try { return new ObjectId(id); } catch { return id; }
        });
        
        const users = await db.collection('admin_users')
          .find({ _id: { $in: userIdsObj } })
          .project({ username: 1, firstName: 1, lastName: 1 })
          .toArray();
          
        const userMap = users.reduce((acc, u) => {
          acc[u._id.toString()] = u;
          return acc;
        }, {});

        newMessages = msgs.map(m => {
          const sender = userMap[m.senderId];
          return {
            ...m,
            _id: m._id.toString(),
            senderName: sender ? (sender.firstName || sender.lastName ? `${sender.firstName} ${sender.lastName}`.trim() : sender.username) : 'Unknown'
          };
        });
      }
    }

    return NextResponse.json({
      serverTimestamp,
      newMessages
    });
  } catch (err) {
    console.error('Group poll error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
