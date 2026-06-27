import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../../lib/mongodb';
import { ObjectId, GridFSBucket } from 'mongodb';
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

export async function POST(req, { params }) {
  try {
    const { id: groupId, messageId } = await params;
    const { searchParams } = new URL(req.url);
    const forEveryone = searchParams.get('forEveryone') === 'true';

    if (!ObjectId.isValid(groupId) || !ObjectId.isValid(messageId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
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

    const message = await db.collection('group_chat_messages').findOne({ _id: new ObjectId(messageId), groupId });
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (forEveryone) {
      // Only sender can delete for everyone
      if (message.senderId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Check if message is an image message and has mediaUrl
      if (message.type === 'image' && message.mediaUrl) {
        const urlParts = message.mediaUrl.split('/');
        const fileIdStr = urlParts[urlParts.length - 1];
        if (ObjectId.isValid(fileIdStr)) {
          const fileId = new ObjectId(fileIdStr);
          
          // Verify if any other active message references the same media URL (for deduplication safety)
          const dmCount = await db.collection('chat_messages').countDocuments({ mediaUrl: message.mediaUrl, deletedForEveryone: { $ne: true } });
          const teamCount = await db.collection('team_messages').countDocuments({ mediaUrl: message.mediaUrl, deletedForEveryone: { $ne: true } });
          const groupCount = await db.collection('group_chat_messages').countDocuments({ mediaUrl: message.mediaUrl, deletedForEveryone: { $ne: true } });
          
          if ((dmCount + teamCount + groupCount) <= 1) {
            const bucket = new GridFSBucket(db, { bucketName: 'chat_media' });
            await bucket.delete(fileId).catch(err => console.error('GridFS media deletion failed in Group delete:', err));
          }
        }
      }

      await db.collection('group_chat_messages').updateOne(
        { _id: new ObjectId(messageId) },
        { 
          $set: { 
            deletedForEveryone: true,
            body: '[Message deleted]'
          } 
        }
      );
    } else {
      // Delete for me
      await db.collection('group_chat_messages').updateOne(
        { _id: new ObjectId(messageId) },
        { $addToSet: { deletedFor: userId } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete message error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
