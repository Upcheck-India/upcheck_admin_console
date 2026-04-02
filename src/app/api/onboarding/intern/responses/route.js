import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET /api/onboarding/intern/responses
 * Get all intern onboarding responses (Admin/Console admin or users.manage/recruitment.manage only)
 */
export async function GET(req) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { password: 0, sessionToken: 0 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permissions
    const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
    const hasPermission = user.perms?.includes('users.manage') || user.perms?.includes('recruitment.manage');

    if (!isAdmin && !hasPermission) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get query params
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // completed, in_progress, skipped
    const userId = searchParams.get('userId');

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }
    if (userId) {
      query.userId = new ObjectId(userId);
    }

    // Fetch onboarding responses with user info
    const onboardingResponses = await db.collection('intern_onboarding')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'admin_users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            userId: 1,
            currentStep: 1,
            responses: 1,
            status: 1,
            skipped: 1,
            roleAtOnboarding: 1,
            createdAt: 1,
            updatedAt: 1,
            completedAt: 1,
            skippedAt: 1,
            'user.username': 1,
            'user.email': 1,
            'user.firstName': 1,
            'user.lastName': 1,
            'user.role': 1,
            'user.department': 1,
            'user.createdAt': 1
          }
        },
        { $sort: { updatedAt: -1 } }
      ])
      .toArray();

    return NextResponse.json({
      responses: onboardingResponses,
      total: onboardingResponses.length
    });

  } catch (error) {
    console.error('Error fetching onboarding responses:', error);
    return NextResponse.json({ error: 'Failed to fetch onboarding responses' }, { status: 500 });
  }
}
