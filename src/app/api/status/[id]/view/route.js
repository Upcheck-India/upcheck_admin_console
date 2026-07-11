import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAuthUser } from '../../../../../lib/auth';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid status ID' }, { status: 400 });
    }

    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    const status = await db.collection('status_updates').findOne({ _id: new ObjectId(id), deletedAt: null });
    if (!status) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Owners don't "view" their own status — only record real audience views.
    if (status.userId === currentUser._id.toString()) {
      return NextResponse.json({ success: true, skipped: true });
    }

    await db.collection('status_views').updateOne(
      { statusId: status._id, viewerId: currentUser._id.toString() },
      { $setOnInsert: { statusId: status._id, viewerId: currentUser._id.toString(), viewedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Status view error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
