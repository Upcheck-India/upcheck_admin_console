import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';

// Helper function to validate ObjectId
function isValidObjectId(id) {
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
}

export async function GET(req, { params }) {
  try {
    const userId = params.id;
    
    // Validate user ID
    if (!isValidObjectId(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }
    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { githubProfile: 1 } }
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Return the GitHub profile data if it exists
    return NextResponse.json({
      currentRepo: user.githubProfile?.currentRepo || null,
      notes: user.githubProfile?.notes || ''
    });
  } catch (error) {
    console.error('Error fetching GitHub profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req, { params }) {
  try {
    const userId = params.id;
    
    // Validate user ID
    if (!isValidObjectId(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }
    
    // Validate request body
    const { currentRepo, notes } = await req.json();
    
    if (currentRepo && typeof currentRepo !== 'object') {
      return NextResponse.json(
        { error: 'Invalid repository data' },
        { status: 400 }
      );
    }
    const client = await clientPromise;
    const db = client.db('resources');

    // Update the user's GitHub profile data
    const updateData = {
      githubProfile: currentRepo 
        ? { 
            currentRepo: currentRepo,
            notes: notes || '',
            updatedAt: new Date()
          }
        : null
    };

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData },
      { upsert: false } // Don't create new users with this endpoint
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    if (!result.acknowledged) {
      throw new Error('Failed to update GitHub profile');
    }

    // Return the updated profile
    const updatedUser = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { githubProfile: 1 } }
    );

    return NextResponse.json({
      success: true,
      currentRepo: updatedUser?.githubProfile?.currentRepo || null,
      notes: updatedUser?.githubProfile?.notes || ''
    });
  } catch (error) {
    console.error('Error updating GitHub profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
