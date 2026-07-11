import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAuthUser } from '../../../../../lib/auth';
import { sendStatusLinkedMessage } from '../../../../../lib/status/dmBridge';
import { canViewerSeeOwnersStatus } from '../../../../../lib/status/privacy';

const MAX_REPLY_LENGTH = 2000;

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid status ID' }, { status: 400 });
    }

    const { body } = await request.json();
    const trimmed = (body || '').toString().trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Reply text is required' }, { status: 400 });
    }
    if (trimmed.length > MAX_REPLY_LENGTH) {
      return NextResponse.json({ error: 'Reply is too long' }, { status: 400 });
    }

    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    const status = await db.collection('status_updates').findOne({ _id: new ObjectId(id), deletedAt: null });
    if (!status) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (status.userId === currentUser._id.toString()) {
      return NextResponse.json({ error: "Can't reply to your own status" }, { status: 400 });
    }

    // Defense in depth — see the equivalent check in view/route.js.
    if (!(await canViewerSeeOwnersStatus(db, status.userId, currentUser._id.toString()))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const message = await sendStatusLinkedMessage({
      db,
      senderUser: currentUser,
      recipientId: status.userId,
      body: trimmed,
      statusContext: {
        statusId: status._id.toString(),
        statusMediaUrl: status.mediaUrl,
        statusCaption: status.caption || '',
        kind: 'reply',
      },
    });

    return NextResponse.json({ success: true, message });
  } catch (err) {
    console.error('Status reply error:', err);
    if (err.message === 'No conversation exists between these users') {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
