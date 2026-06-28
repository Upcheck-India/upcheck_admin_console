import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb.js';
import { ObjectId, GridFSBucket } from 'mongodb';
import { getAuthUser } from '../../../../../../lib/auth.js';

export async function POST(request, { params }) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = authData.user;
    const db = authData.db;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const forEveryone = searchParams.get('forEveryone') === 'true';

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 });
    }

    const message = await db.collection('chat_messages').findOne({ _id: new ObjectId(id) });
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Verify participant: current user must be sender or recipient of the message
    const isSender = message.senderId === currentUser._id.toString();
    const isRecipient = message.recipientId === currentUser._id.toString();
    if (!isSender && !isRecipient) {
      return NextResponse.json({ error: 'Unauthorized message access' }, { status: 403 });
    }

    if (forEveryone) {
      if (!isSender) {
        return NextResponse.json({ error: 'Only the sender can delete for everyone' }, { status: 403 });
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
            await bucket.delete(fileId).catch(err => console.error('GridFS media deletion failed in DM delete:', err));
          }
        }
      }

      await db.collection('chat_messages').updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            deletedForEveryone: true, 
            body: '[Message deleted]', 
            type: 'text',
            updatedAt: new Date() 
          },
          $unset: {
            mediaUrl: ""
          }
        }
      );
    } else {
      await db.collection('chat_messages').updateOne(
        { _id: new ObjectId(id) },
        { $addToSet: { deletedFor: currentUser._id.toString() } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete DM message error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
