import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET /api/onboarding/intern/[userId]
 * Get specific user's intern onboarding data (Admin/Console admin or users.manage/recruitment.manage only)
 */
export async function GET(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const currentUser = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { password: 0, sessionToken: 0 } }
    );

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permissions
    const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Console admin';
    const hasPermission = currentUser.perms?.includes('users.manage') || currentUser.perms?.includes('recruitment.manage');

    if (!isAdmin && !hasPermission) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { userId } = params;

    if (!ObjectId.isValid(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // Fetch the specific user's onboarding data
    const onboarding = await db.collection('intern_onboarding').findOne({
      userId: new ObjectId(userId)
    });

    if (!onboarding) {
      return NextResponse.json({ error: 'Onboarding data not found' }, { status: 404 });
    }

    // Fetch user details
    const targetUser = await db.collection('admin_users').findOne(
      { _id: new ObjectId(userId) },
      { 
        projection: { 
          password: 0, 
          sessionToken: 0,
          webauthn: 0
        } 
      }
    );

    return NextResponse.json({
      onboarding,
      user: targetUser
    });

  } catch (error) {
    console.error('Error fetching user onboarding data:', error);
    return NextResponse.json({ error: 'Failed to fetch onboarding data' }, { status: 500 });
  }
}

/**
 * DELETE /api/onboarding/intern/[userId]
 * Reset user's intern onboarding (Admin only)
 */
export async function DELETE(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const currentUser = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { password: 0, sessionToken: 0 } }
    );

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only Admin can reset onboarding
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Console admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { userId } = params;

    if (!ObjectId.isValid(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // Delete onboarding record
    await db.collection('intern_onboarding').deleteOne({
      userId: new ObjectId(userId)
    });

    // Update user record
    await db.collection('admin_users').updateOne(
      { _id: new ObjectId(userId) },
      { 
        $unset: { 'onboarding.intern': '' },
        $set: { updatedAt: new Date() }
      }
    );

    return NextResponse.json({ success: true, message: 'Onboarding reset successfully' });

  } catch (error) {
    console.error('Error resetting onboarding:', error);
    return NextResponse.json({ error: 'Failed to reset onboarding' }, { status: 500 });
  }
}
