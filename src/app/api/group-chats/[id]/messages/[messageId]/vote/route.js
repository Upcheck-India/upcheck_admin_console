import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

async function getAuthUser(req) {
  const authHeader = req.headers.get('authorization');
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const cookieStore = cookies();
    token = cookieStore.get('admin_token')?.value;
  }
  if (!token) return null;
  const client = await clientPromise;
  const db = client.db('resources');
  return await db.collection('admin_users').findOne({ sessionToken: token });
}

export async function POST(req, { params }) {
  try {
    const { id: groupId, messageId } = params;
    if (!ObjectId.isValid(groupId) || !ObjectId.isValid(messageId)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { db } = auth;
    const userId = auth._id.toString();

    const { optionId } = await req.json();
    if (!optionId) {
      return NextResponse.json({ error: 'optionId is required' }, { status: 400 });
    }

    const message = await db.collection('group_chat_messages').findOne({
      _id: new ObjectId(messageId),
      groupId
    });

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
        username: auth.username,
        firstName: auth.firstName || '',
        lastName: auth.lastName || '',
        optionId,
        createdAt: new Date()
      });
    }

    await db.collection('group_chat_messages').updateOne(
      { _id: new ObjectId(messageId) },
      { $set: { 'poll.votes': votes } }
    );

    return NextResponse.json({ success: true, votes });
  } catch (err) {
    console.error('Group Poll vote error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
