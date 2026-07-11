import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAuthUser } from '../../../../lib/auth';
import { deleteStatusMedia } from '../../../../lib/status/media';

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid status ID' }, { status: 400 });
    }

    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    const status = await db.collection('status_updates').findOne({ _id: new ObjectId(id) });
    if (!status) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (status.userId !== currentUser._id.toString()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteStatusMedia(db, status);
    await db.collection('status_updates').deleteOne({ _id: status._id });
    await db.collection('status_views').deleteMany({ statusId: status._id });
    await db.collection('status_reactions').deleteMany({ statusId: status._id });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Status delete error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
