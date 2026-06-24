import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

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

export async function POST(request) {
  try {
    const currentUser = await getAuthUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { messageId, teamId, type } = await request.json(); // type: 'me' | 'everyone'

    if (!messageId || !ObjectId.isValid(messageId) || !teamId || !ObjectId.isValid(teamId)) {
      return NextResponse.json({ error: 'Valid messageId and teamId required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const message = await db.collection('team_messages').findOne({ _id: new ObjectId(messageId), teamId });
    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    const userId = currentUser._id.toString();

    if (type === 'everyone') {
      // Must be sender, OR team lead
      const team = await db.collection('teams').findOne({ _id: new ObjectId(teamId) });
      const isLead = team && team.lead && team.lead.toString() === userId;
      
      if (message.senderId !== userId && !isLead && currentUser.role !== 'Admin') {
        return NextResponse.json({ error: 'Permission denied to delete for everyone' }, { status: 403 });
      }

      await db.collection('team_messages').updateOne(
        { _id: new ObjectId(messageId) },
        { $set: { deletedForEveryone: true, body: '[Message deleted]' } }
      );
    } else {
      // Delete for me
      await db.collection('team_messages').updateOne(
        { _id: new ObjectId(messageId) },
        { $addToSet: { deletedFor: userId } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Team chat delete error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
