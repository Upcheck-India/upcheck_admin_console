import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb.js';
import { deleteStatusMedia } from '../../../../lib/status/media';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'cron-secret'}`) {
      return NextResponse.json({ error: 'Unauthorized cron' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const expired = await db.collection('status_updates').find({
      expiresAt: { $lt: new Date() },
      deletedAt: null,
    }).toArray();

    let deletedCount = 0;
    for (const status of expired) {
      try {
        await deleteStatusMedia(db, status);
        await db.collection('status_updates').deleteOne({ _id: status._id });
        await db.collection('status_views').deleteMany({ statusId: status._id });
        await db.collection('status_reactions').deleteMany({ statusId: status._id });
        deletedCount++;
      } catch (e) {
        console.error(`Failed to clean up expired status ${status._id}:`, e);
      }
    }

    return NextResponse.json({ success: true, deletedCount });
  } catch (err) {
    console.error('Status cleanup error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
