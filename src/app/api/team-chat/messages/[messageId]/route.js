import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function PATCH(request, { params }) {
  try {
    const { messageId } = await params;
    const { body } = await request.json();

    if (!messageId || !ObjectId.isValid(messageId)) {
      return NextResponse.json({ error: 'Invalid Message ID' }, { status: 400 });
    }

    if (!body?.trim()) {
      return NextResponse.json({ error: 'Message body required' }, { status: 400 });
    }

    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    const message = await db.collection('team_messages').findOne({ _id: new ObjectId(messageId) });
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (message.senderId !== currentUser._id.toString()) {
      return NextResponse.json({ error: 'Only the sender can edit this message' }, { status: 403 });
    }

    const timeDiff = Date.now() - new Date(message.createdAt).getTime();
    if (timeDiff > 30 * 60 * 1000) {
      return NextResponse.json({ error: 'Messages can only be edited within 30 minutes of sending' }, { status: 400 });
    }

    const updateRes = await db.collection('team_messages').findOneAndUpdate(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          body: body.trim(),
          isEdited: true,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    const updatedDoc = updateRes.value || updateRes;

    return NextResponse.json({ success: true, message: updatedDoc });
  } catch (err) {
    console.error('Edit Team message error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
