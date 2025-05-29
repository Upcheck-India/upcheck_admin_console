import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { cookies } from 'next/headers';

export async function PATCH(req) {
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

    const { applicantId, action } = await req.json();

    if (!applicantId) {
      return NextResponse.json(
        { message: 'Applicant ID is required' },
        { status: 400 }
      );
    }

    if (!['delete', 'revoke', 'restore'].includes(action)) {
      return NextResponse.json(
        { message: 'Invalid action' },
        { status: 400 }
      );
    }

    // Get the applicant
    const applicant = await db.collection('applicants').findOne({ applicantId });
    if (!applicant) {
      return NextResponse.json(
        { message: 'Applicant not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'delete':
        // For completed applications, completely remove them
        if (!applicant.hasAttempted) {
          return NextResponse.json(
            { message: 'Only completed applications can be deleted. Use revoke for pending applications.' },
            { status: 400 }
          );
        }
        // Delete the applicant and their test attempts
        await Promise.all([
          db.collection('applicants').deleteOne({ applicantId }),
          db.collection('test_attempts').deleteMany({ applicantId })
        ]);
        break;

      case 'revoke':
        // Only allow revoking pending applications
        if (applicant.hasAttempted) {
          return NextResponse.json(
            { message: 'Cannot revoke completed applications. Use delete instead.' },
            { status: 400 }
          );
        }
        // Revoke access by marking as revoked
        await db.collection('applicants').updateOne(
          { applicantId },
          { 
            $set: { 
              status: 'revoked',
              revokedAt: new Date(),
              hasAttempted: false
            }
          }
        );
        break;

      case 'restore':
        // Remove revoked/deleted status
        await db.collection('applicants').updateOne(
          { applicantId },
          { 
            $unset: { 
              status: "",
              revokedAt: ""
            }
          }
        );
        break;
    }

    return NextResponse.json({
      success: true,
      message: `Applicant ${action}d successfully`
    });
  } catch (error) {
    console.error(`Error ${action}ing applicant:`, error);
    return NextResponse.json(
      { message: `Failed to ${action} applicant` },
      { status: 500 }
    );
  }
}