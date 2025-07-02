import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const userId = params.id;
    const client = await clientPromise;
    const db = client.db();

    const user = await db.collection('users').findOne({
      _id: new ObjectId(userId)
    });

    if (!user) {
      return new NextResponse(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    // Return the GitHub profile data if it exists
    return NextResponse.json({
      currentRepo: user.githubProfile?.currentRepo || null,
      notes: user.githubProfile?.notes || ''
    });
  } catch (error) {
    console.error('Error fetching GitHub profile:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const userId = params.id;
    const { currentRepo, notes } = await req.json();
    const client = await clientPromise;
    const db = client.db();

    // Update the user's GitHub profile data
    const updateData = {
      'githubProfile.currentRepo': currentRepo || null,
      'githubProfile.notes': currentRepo ? (notes || '') : ''
    };

    // Remove the githubProfile field if both currentRepo and notes are empty
    if (!currentRepo) {
      updateData.githubProfile = null;
    }

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData },
      { upsert: true }
    );

    if (!result.acknowledged) {
      throw new Error('Failed to update GitHub profile');
    }

    return NextResponse.json({ 
      success: true,
      currentRepo: currentRepo || null,
      notes: currentRepo ? (notes || '') : ''
    });
  } catch (error) {
    console.error('Error updating GitHub profile:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
