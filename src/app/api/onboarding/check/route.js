import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

/**
 * GET /api/onboarding/check
 * Check if current user needs to complete onboarding
 * Returns redirect URL if onboarding is required
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

    // Check if user is an Intern
    if (user.role !== 'Intern') {
      return NextResponse.json({
        requiresOnboarding: false,
        role: user.role
      });
    }

    // Check if intern onboarding is completed
    const onboarding = await db.collection('intern_onboarding').findOne({
      userId: user._id,
      status: 'completed'
    });

    // Also check the user record for onboarding completion flag
    const hasCompletedOnboarding = onboarding || user.onboarding?.intern?.completed;

    if (hasCompletedOnboarding) {
      return NextResponse.json({
        requiresOnboarding: false,
        role: user.role,
        onboardingCompleted: true
      });
    }

    // Check if onboarding was skipped (allow them to continue to console but show reminder)
    const skippedOnboarding = await db.collection('intern_onboarding').findOne({
      userId: user._id,
      skipped: true
    });

    if (skippedOnboarding) {
      return NextResponse.json({
        requiresOnboarding: false,
        role: user.role,
        onboardingSkipped: true,
        canContinueOnboarding: true
      });
    }

    // Intern needs to complete onboarding
    return NextResponse.json({
      requiresOnboarding: true,
      role: user.role,
      redirectUrl: '/onboarding/intern'
    });

  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return NextResponse.json({ error: 'Failed to check onboarding status' }, { status: 500 });
  }
}
