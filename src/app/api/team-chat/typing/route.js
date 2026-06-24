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

    const { teamId } = await request.json();
    if (!teamId || !ObjectId.isValid(teamId)) {
      return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const name = currentUser.firstName && currentUser.lastName
      ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
      : currentUser.username;

    await db.collection('team_typing').updateOne(
      { teamId, userId: currentUser._id.toString() },
      { 
        $set: { 
          username: currentUser.username,
          name,
          updatedAt: new Date() 
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Team chat typing error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
