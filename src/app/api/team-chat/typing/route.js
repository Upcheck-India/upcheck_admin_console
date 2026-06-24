import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = authData.user;
    const db = authData.db;

    const { teamId } = await request.json();
    if (!teamId || !ObjectId.isValid(teamId)) {
      return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    }

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
