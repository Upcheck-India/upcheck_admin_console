import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb.js';
import { GridFSBucket } from 'mongodb';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'cron-secret'}`) {
      return NextResponse.json({ error: 'Unauthorized cron' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const bucket = new GridFSBucket(db, { bucketName: 'chat_media' });

    // Find files where refs === 0 and uploadedAt is older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const orphanedFiles = await db.collection('chat_media.files').find({
      'metadata.refs': 0,
      'metadata.uploadedAt': { $lt: oneDayAgo }
    }).toArray();

    let deletedCount = 0;
    for (const file of orphanedFiles) {
      try {
        await bucket.delete(file._id);
        deletedCount++;
      } catch (e) {
        console.error(`Failed to delete orphaned file ${file._id}:`, e);
      }
    }

    // Clean up old cancelled uploads records too
    await db.collection('cancelled_uploads').deleteMany({
      cancelledAt: { $lt: oneDayAgo }
    });

    return NextResponse.json({ success: true, deletedCount });

  } catch (err) {
    console.error('Media cleanup error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
