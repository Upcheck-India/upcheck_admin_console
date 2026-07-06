import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(req, { params }) {
  try {
    const messageId = params.id;
    if (!ObjectId.isValid(messageId)) {
      return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 });
    }

    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;
    const userId = currentUser._id.toString();

    const { optionId } = await req.json();
    if (!optionId) {
      return NextResponse.json({ error: 'optionId is required' }, { status: 400 });
    }

    const message = await db.collection('chat_messages').findOne({ _id: new ObjectId(messageId) });
    if (!message || message.type !== 'poll' || !message.poll) {
      return NextResponse.json({ error: 'Poll message not found' }, { status: 404 });
    }

    const poll = message.poll;
    let votes = poll.votes || [];

    const existingVoteIdx = votes.findIndex(v => v.userId === userId && v.optionId === optionId);

    if (existingVoteIdx >= 0) {
      votes.splice(existingVoteIdx, 1);
    } else {
      if (!poll.allowMultiple) {
        votes = votes.filter(v => v.userId !== userId);
      }
      votes.push({
        userId,
        username: currentUser.username,
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        optionId,
        createdAt: new Date()
      });
    }

    await db.collection('chat_messages').updateOne(
      { _id: new ObjectId(messageId) },
      { $set: { 'poll.votes': votes, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true, votes });
  } catch (err) {
    console.error('Poll vote error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
