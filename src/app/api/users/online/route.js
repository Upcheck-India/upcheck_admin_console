import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    
    // Get all users who were active in the last 2 minutes
    const onlineUsers = await db.collection('admin_users').find({
      lastSeen: { $gt: new Date(Date.now() - 2 * 60 * 1000) } // 2 minutes window
    }).toArray();
    
    return NextResponse.json({
      users: onlineUsers.map(user => ({
        _id: user._id.toString(),
        username: user.username,
        role: user.role,
        avatar: user.avatar
      }))
    });
  } catch (error) {
    console.error('Error fetching online users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch online users' },
      { status: 500 }
    );
  }
}
