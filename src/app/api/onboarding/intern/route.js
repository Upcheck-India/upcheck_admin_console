import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET /api/onboarding/intern
 * Get current user's intern onboarding status and data
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

    // Get onboarding record for this user
    const onboarding = await db.collection('intern_onboarding').findOne({
      userId: user._id
    });

    // Get existing user data to personalize onboarding
    const existingData = {
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      location: user.location,
      department: user.department,
      role: user.role,
      bio: user.bio,
      linkedinProfile: user.linkedinProfile,
      createdAt: user.createdAt
    };

    return NextResponse.json({
      onboarding: onboarding || null,
      existingData,
      isComplete: onboarding?.status === 'completed',
      currentStep: onboarding?.currentStep || 0,
      isIntern: user.role === 'Intern'
    });

  } catch (error) {
    console.error('Error fetching onboarding status:', error);
    return NextResponse.json({ error: 'Failed to fetch onboarding status' }, { status: 500 });
  }
}

/**
 * POST /api/onboarding/intern
 * Save intern onboarding progress
 */
export async function POST(req) {
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

    const body = await req.json();
    const { currentStep, responses, status, skipped } = body;

    // Check if onboarding record exists
    const existingOnboarding = await db.collection('intern_onboarding').findOne({
      userId: user._id
    });

    const now = new Date();

    if (existingOnboarding) {
      // Update existing record
      const updateData = {
        currentStep: currentStep ?? existingOnboarding.currentStep,
        updatedAt: now,
        lastActiveAt: now
      };

      if (responses) {
        updateData.responses = { ...existingOnboarding.responses, ...responses };
      }

      if (status) {
        updateData.status = status;
        if (status === 'completed') {
          updateData.completedAt = now;
        }
      }

      if (skipped !== undefined) {
        updateData.skipped = skipped;
        if (skipped) {
          updateData.skippedAt = now;
        }
      }

      await db.collection('intern_onboarding').updateOne(
        { userId: user._id },
        { $set: updateData }
      );

      const updated = await db.collection('intern_onboarding').findOne({ userId: user._id });
      return NextResponse.json({ success: true, onboarding: updated });

    } else {
      // Create new onboarding record
      const newOnboarding = {
        userId: user._id,
        userInfo: {
          username: user.username,
          email: user.email,
          role: user.role
        },
        currentStep: currentStep || 0,
        responses: responses || {},
        status: status || 'in_progress',
        skipped: skipped || false,
        roleAtOnboarding: user.role,
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
        completedAt: null,
        skippedAt: null
      };

      const result = await db.collection('intern_onboarding').insertOne(newOnboarding);
      return NextResponse.json({ 
        success: true, 
        onboarding: { ...newOnboarding, _id: result.insertedId } 
      });
    }

  } catch (error) {
    console.error('Error saving onboarding progress:', error);
    return NextResponse.json({ error: 'Failed to save onboarding progress' }, { status: 500 });
  }
}

/**
 * PUT /api/onboarding/intern
 * Complete or update onboarding with final data
 */
export async function PUT(req) {
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

    const body = await req.json();
    const { responses, profileUpdates } = body;

    const now = new Date();

    // Update onboarding record
    await db.collection('intern_onboarding').updateOne(
      { userId: user._id },
      {
        $set: {
          responses,
          status: 'completed',
          completedAt: now,
          updatedAt: now
        }
      },
      { upsert: true }
    );

    // Update user profile with any new information
    if (profileUpdates && Object.keys(profileUpdates).length > 0) {
      const allowedUpdates = ['firstName', 'lastName', 'phone', 'location', 'bio', 'linkedinProfile', 'alternateEmail'];
      const safeUpdates = {};
      
      for (const key of allowedUpdates) {
        if (profileUpdates[key] !== undefined) {
          safeUpdates[key] = profileUpdates[key];
        }
      }

      if (Object.keys(safeUpdates).length > 0) {
        await db.collection('admin_users').updateOne(
          { _id: user._id },
          { $set: { ...safeUpdates, updatedAt: now } }
        );
      }
    }

    // Mark onboarding as completed in user record
    await db.collection('admin_users').updateOne(
      { _id: user._id },
      { 
        $set: { 
          'onboarding.intern.completed': true,
          'onboarding.intern.completedAt': now,
          updatedAt: now
        } 
      }
    );

    return NextResponse.json({ success: true, message: 'Onboarding completed successfully' });

  } catch (error) {
    console.error('Error completing onboarding:', error);
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
  }
}
