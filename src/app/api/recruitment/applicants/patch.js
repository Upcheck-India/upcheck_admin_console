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

    if (!['trash', 'revoke', 'restore', 'delete'].includes(action)) {
      return NextResponse.json(
        { message: 'Invalid action' },
        { status: 400 }
      );
    }

    if (action === 'delete') {
      const applicant = await db.collection('applicants').findOne({ applicantId });
      if (!applicant) {
        return NextResponse.json(
          { message: 'Applicant not found' },
          { status: 404 }
        );
      }
      if (!applicant.deleted && applicant.status !== 'revoked') {
        return NextResponse.json(
          { message: 'Applicant must be in trash or revoked state for deletion' },
          { status: 400 }
        );
      }
      await db.collection('applicants').deleteOne({ applicantId });
      return NextResponse.json({
        success: true,
        message: 'Applicant permanently deleted'
      });
    }

    let updateData = {};
    
    if (action === 'trash') {
      updateData = { deleted: true };
    } else if (action === 'revoke') {
      updateData = { status: 'revoked', hasAttempted: false };
    } else if (action === 'restore') {
      updateData = { deleted: false, status: 'pending' };
    }

    await db.collection('applicants').updateOne(
      { applicantId },
      { $set: updateData }
    );

    return NextResponse.json({
      success: true,
      message: `Applicant ${action === 'trash' ? 'moved to trash' : action === 'revoke' ? 'revoked' : 'restored'} successfully`
    });
  } catch (error) {
    console.error(`Error updating applicant:`, error);
    return NextResponse.json(
      { message: 'Failed to update applicant' },
      { status: 500 }
    );
  }
}