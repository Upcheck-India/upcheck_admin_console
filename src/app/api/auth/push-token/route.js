import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { token: pushToken } = await req.json();

    if (!pushToken) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const currentUser = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await db.collection('admin_users').updateOne(
      { _id: currentUser._id },
      { $set: { expoPushToken: pushToken, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true, message: 'Push token registered successfully' });
  } catch (error) {
    console.error('Push token registration error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

