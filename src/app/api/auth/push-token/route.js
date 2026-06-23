import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getAdminSession } from '@/lib/adminSession';
import { ObjectId } from 'mongodb';

export async function POST(req) {
  try {
    const session = await getAdminSession();
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    await db.collection('admin_users').updateOne(
      { _id: new ObjectId(session.userId) },
      { $set: { expoPushToken: token, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true, message: 'Push token registered successfully' });
  } catch (error) {
    console.error('Push token registration error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
