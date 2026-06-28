import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb.js';
import { getAuthUser } from '../../../../lib/auth.js';
import { GridFSBucket } from 'mongodb';

export async function POST(request) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, db } = authData;

    const { clientId } = await request.json();

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    // Find the uploaded file in GridFS by clientId and uploadedBy
    const file = await db.collection('chat_media.files').findOne({
      'metadata.clientId': clientId,
      'metadata.uploadedBy': user._id.toString()
    });

    if (!file) {
      // It might not have finished uploading yet, or it was never started.
      // But we can store a cancellation record so if the upload finishes later, it gets auto-deleted.
      await db.collection('cancelled_uploads').updateOne(
        { clientId, uploadedBy: user._id.toString() },
        { $set: { cancelledAt: new Date() } },
        { upsert: true }
      );
      return NextResponse.json({ success: true, message: 'Upload cancellation recorded' });
    }

    // File found. Check refs safely.
    if (file.metadata?.refs > 0) {
      return NextResponse.json({ error: 'File is already referenced by a sent message' }, { status: 403 });
    }

    // Also check if any message references it just to be 100% sure
    const mediaUrl = `/api/chat/media/${file._id.toString()}`;
    const dmCount = await db.collection('chat_messages').countDocuments({ mediaUrl });
    const teamCount = await db.collection('team_messages').countDocuments({ mediaUrl });
    const groupCount = await db.collection('group_chat_messages').countDocuments({ mediaUrl });

    if (dmCount + teamCount + groupCount > 0) {
      return NextResponse.json({ error: 'File is referenced by a sent message' }, { status: 403 });
    }

    const bucket = new GridFSBucket(db, { bucketName: 'chat_media' });
    await bucket.delete(file._id);

    return NextResponse.json({ success: true, message: 'Upload cancelled and file deleted permanently' });

  } catch (err) {
    console.error('Cancel upload error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
