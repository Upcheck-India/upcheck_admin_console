import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAuthUser } from '../../../../../lib/auth';
import { sendStatusLinkedMessage } from '../../../../../lib/status/dmBridge';
import { canViewerSeeOwnersStatus } from '../../../../../lib/status/privacy';

const MAX_EMOJI_LENGTH = 8; // generous cap for multi-codepoint emoji, not a real message

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid status ID' }, { status: 400 });
    }

    const { emoji } = await request.json();
    if (!emoji || typeof emoji !== 'string' || emoji.length > MAX_EMOJI_LENGTH) {
      return NextResponse.json({ error: 'A valid emoji is required' }, { status: 400 });
    }

    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    const status = await db.collection('status_updates').findOne({ _id: new ObjectId(id), deletedAt: null });
    if (!status) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Defense in depth — see the equivalent check in view/route.js.
    if (!(await canViewerSeeOwnersStatus(db, status.userId, currentUser._id.toString()))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await db.collection('status_reactions').updateOne(
      { statusId: status._id, userId: currentUser._id.toString() },
      { $set: { statusId: status._id, userId: currentUser._id.toString(), emoji, createdAt: new Date() } },
      { upsert: true }
    );

    if (status.userId !== currentUser._id.toString()) {
      try {
        await sendStatusLinkedMessage({
          db,
          senderUser: currentUser,
          recipientId: status.userId,
          body: emoji,
          statusContext: {
            statusId: status._id.toString(),
            statusMediaUrl: status.mediaUrl,
            statusCaption: status.caption || '',
            kind: 'reaction',
            emoji,
          },
        });
      } catch (bridgeErr) {
        // No DM connection exists (shouldn't normally happen since status
        // visibility is scoped to connections already) — the reaction
        // itself is still recorded, just without a DM notification.
        console.warn('Status reaction DM bridge skipped:', bridgeErr.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Status react error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid status ID' }, { status: 400 });
    }

    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    await db.collection('status_reactions').deleteOne({
      statusId: new ObjectId(id),
      userId: currentUser._id.toString(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Status unreact error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
