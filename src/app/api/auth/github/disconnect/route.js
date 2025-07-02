import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';

export async function POST() {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    
    // Get the current user's session
    const sessionToken = cookies().get('admin_token')?.value;
    if (!sessionToken) {
      throw new Error('No active session found');
    }

    // Find the current user
    const user = await db.collection('admin_users').findOne({ sessionToken });
    if (!user) {
      throw new Error('User not found');
    }

    // Remove GitHub OAuth data
    await db.collection('admin_users').updateOne(
      { _id: user._id },
      { 
        $unset: { 'oauth.github': '' },
        $set: { updatedAt: new Date() }
      }
    );

    return NextResponse.json({ 
      success: true,
      message: 'GitHub account disconnected successfully'
    });

  } catch (error) {
    console.error('GitHub Disconnect error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect GitHub account' },
      { status: 500 }
    );
  }
}
