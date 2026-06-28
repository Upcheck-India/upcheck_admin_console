import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
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

export async function POST(request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { groupId } = await request.json();
    if (!groupId || !ObjectId.isValid(groupId)) {
      return NextResponse.json({ error: 'groupId required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const name = authUser.firstName && authUser.lastName
      ? `${authUser.firstName} ${authUser.lastName}`.trim()
      : authUser.username;

    await db.collection('group_typing').updateOne(
      { groupId, userId: authUser._id.toString() },
      { 
        $set: { 
          username: authUser.username,
          name,
          updatedAt: new Date() 
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Group chat typing error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
