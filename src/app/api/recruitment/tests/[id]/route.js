import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

export async function GET(req, { params }) {
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

    const test = await db.collection('test_attempts').findOne({
      _id: new ObjectId(params.id)
    });

    if (!test) {
      return NextResponse.json(
        { message: 'Test not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(test);
  } catch (error) {
    console.error('Error fetching test:', error);
    return NextResponse.json(
      { message: 'Failed to fetch test results' },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
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

    const test = await db.collection('test_attempts').findOne({
      _id: new ObjectId(params.id)
    });

    if (!test) {
      return NextResponse.json(
        { message: 'Test not found' },
        { status: 404 }
      );
    }

    // Delete test attempt and update applicant status
    await Promise.all([
      db.collection('test_attempts').deleteOne({ _id: new ObjectId(params.id) }),
      db.collection('applicants').updateOne(
        { applicantId: test.applicantId },
        { $set: { hasAttempted: false } }
      )
    ]);

    return NextResponse.json({
      success: true,
      message: 'Test deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting test:', error);
    return NextResponse.json(
      { message: 'Failed to delete test' },
      { status: 500 }
    );
  }
}