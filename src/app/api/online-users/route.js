import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/online-users
// Returns users whose lastHeartbeat is within the last 20 seconds.
export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');

    const twentySecondsAgo = new Date(Date.now() - 20000);

    const online = await db
      .collection('admin_users')
      .find({ lastHeartbeat: { $gte: twentySecondsAgo } }, { projection: { password: 0, sessionToken: 0 } })
      .toArray();

    return NextResponse.json(online);
  } catch (error) {
    console.error('Failed to fetch online users', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
