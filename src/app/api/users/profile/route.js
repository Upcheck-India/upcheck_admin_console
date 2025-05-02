import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';

export async function PUT(req) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Find user by session token
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token }
    );

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    const updateData = await req.json();
    
    // Only allow updating specific fields
    const allowedFields = {
      bio: updateData.bio || null,
      location: updateData.location || null,
      alternativeEmail: updateData.alternativeEmail || null,
      linkedinProfile: updateData.linkedinProfile || null
    };

    // Update user document
    const result = await db.collection('admin_users').updateOne(
      { sessionToken: token },
      { $set: allowedFields }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { message: 'No changes made' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        ...user,
        ...allowedFields
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { message: 'Failed to update profile' },
      { status: 500 }
    );
  }
}