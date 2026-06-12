// src/app/api/users/profile/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// GET - Get current user's profile
export async function GET(req) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { password: 0 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get manager info if assigned
    if (user.managerId) {
      const manager = await db.collection('admin_users')
        .findOne({ _id: user.managerId }, { projection: { username: 1, email: 1, role: 1, firstName: 1, lastName: 1 } });
      user.manager = manager;
    }

    // Get teams this user belongs to
    const userIdStr = user._id.toString();
    const teams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
          { lead: userIdStr }
        ]
      })
      .project({ name: 1, description: 1 })
      .toArray();

    user.teams = teams.map(t => ({
      _id: t._id,
      name: t.name,
      description: t.description,
      isLead: t.lead === userIdStr || t.lead?.toString() === userIdStr
    }));

    return NextResponse.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// PUT - Update current user's profile (self-service)
export async function PUT(req) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    const existingUser = await db.collection('admin_users').findOne(
      { sessionToken: token }
    );

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data = await req.json();
    const userId = existingUser._id;

    // Fields that users can update themselves
    const allowedFields = [
      'firstName', 'lastName', 'phone', 'location', 'timezone',
      'bio', 'avatar', 'linkedinProfile', 'alternateEmail'
    ];

    const updateData = {
      updatedAt: new Date()
    };

    // Only update allowed fields
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (typeof data[field] === 'string') {
          updateData[field] = data[field].trim();
        } else {
          updateData[field] = data[field];
        }
      }
    }

    // Perform update
    const result = await db.collection('admin_users').updateOne(
      { _id: userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Log profile update
    try {
      await db.collection('user_activity_logs').insertOne({
        action: 'profile_updated',
        targetType: 'user',
        targetId: userId.toString(),
        targetUsername: existingUser.username,
        actorId: userId.toString(),
        actorUsername: existingUser.username,
        timestamp: new Date(),
        metadata: {
          fieldsUpdated: Object.keys(updateData).filter(k => k !== 'updatedAt')
        }
      });
    } catch (logError) {
      console.error('Failed to log profile update:', logError);
    }

    // Fetch updated user
    const updatedUser = await db.collection('admin_users').findOne(
      { _id: userId },
      { projection: { password: 0 } }
    );

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile: ' + error.message }, { status: 500 });
  }
}