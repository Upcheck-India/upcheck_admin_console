import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// Generate a random password of specified length
function generatePassword(length = 8) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }
  return password;
}

// Generate a unique applicant ID
function generateApplicantId(length = 6) {
  const charset = '0123456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    id += charset[randomIndex];
  }
  return id;
}

export async function GET(req) {
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

    // Check permissions
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { perms: 1 } }
    );

    if (!user?.perms?.includes('recruitment.manage')) {
      return NextResponse.json(
        { message: 'Permission denied' },
        { status: 403 }
      );
    }

    // Get URL parameters
    const { searchParams } = new URL(req.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const includeRevoked = searchParams.get('includeRevoked') === 'true';
    
    // Build query based on parameters
    const query = {};
    if (!includeDeleted) {
      query.deleted = { $ne: true };
    }
    if (!includeRevoked) {
      query.status = { $ne: 'revoked' };
    }

    const applicants = await db.collection('applicants')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Check which applicants have attempted their tests
    const testAttempts = await db.collection('test_attempts')
      .find({ applicantId: { $in: applicants.map(a => a.applicantId) } })
      .toArray();

    const applicantsWithStatus = applicants.map(applicant => ({
      ...applicant,
      hasAttempted: testAttempts.some(attempt => attempt.applicantId === applicant.applicantId),
      status: applicant.status || (applicant.hasAttempted ? 'completed' : 'pending')
    }));

    return NextResponse.json(applicantsWithStatus);
  } catch (error) {
    console.error('Error fetching applicants:', error);
    return NextResponse.json(
      { message: 'Failed to fetch applicants' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
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

    // Check permissions
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { perms: 1 } }
    );

    if (!user?.perms?.includes('recruitment.manage')) {
      return NextResponse.json(
        { message: 'Permission denied' },
        { status: 403 }
      );
    }

    const data = await req.json();
    const { name, email, role } = data;

    if (!name || !email || !role) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if role exists
    const roleExists = await db.collection('recruitment_roles').findOne({ id: role });
    if (!roleExists) {
      return NextResponse.json(
        { message: 'Invalid role' },
        { status: 400 }
      );
    }

    // Check if email is already registered
    const existingApplicant = await db.collection('applicants').findOne({ email });
    if (existingApplicant) {
      return NextResponse.json(
        { message: 'Email already registered' },
        { status: 400 }
      );
    }

    // Generate credentials
    let applicantId;
    let isUnique = false;
    while (!isUnique) {
      applicantId = generateApplicantId();
      const existing = await db.collection('applicants').findOne({ applicantId });
      if (!existing) {
        isUnique = true;
      }
    }

    const password = generatePassword();

    const newApplicant = {
      applicantId,
      name,
      email,
      role,
      password,
      createdAt: new Date(),
      createdBy: user._id
    };

    await db.collection('applicants').insertOne(newApplicant);

    return NextResponse.json(newApplicant);
  } catch (error) {
    console.error('Error creating applicant:', error);
    return NextResponse.json(
      { message: 'Failed to create applicant' },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
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

    // Check permissions
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { perms: 1 } }
    );

    if (!user?.perms?.includes('recruitment.manage')) {
      return NextResponse.json(
        { message: 'Permission denied' },
        { status: 403 }
      );
    }

    const data = await req.json();
    const { applicantId } = data;

    if (!applicantId) {
      return NextResponse.json(
        { message: 'Missing applicant ID' },
        { status: 400 }
      );
    }

    // Check if applicant exists
    const applicant = await db.collection('applicants').findOne({ applicantId });
    if (!applicant) {
      return NextResponse.json(
        { message: 'Applicant not found' },
        { status: 404 }
      );
    }

    // Check if applicant has already attempted the test
    const testAttempt = await db.collection('test_attempts').findOne({ applicantId });
    if (testAttempt) {
      return NextResponse.json(
        { message: 'Cannot delete applicant with test attempts' },
        { status: 400 }
      );
    }

    await db.collection('applicants').deleteOne({ applicantId });

    return NextResponse.json({
      success: true,
      message: 'Applicant deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting applicant:', error);
    return NextResponse.json(
      { message: 'Failed to delete applicant' },
      { status: 500 }
    );
  }
}