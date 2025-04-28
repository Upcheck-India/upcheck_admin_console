import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { cookies } from 'next/headers';

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

    // Verify the user is a Console admin
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { role: 1, perms: 1 } }
    );

    if (!user || user.role !== 'Console admin') {
      return NextResponse.json(
        { message: 'Permission denied' },
        { status: 403 }
      );
    }

    // Update Console admin and Admin roles to include recruitment.manage permission
    await db.collection('admin_users').updateMany(
      { role: { $in: ['Console admin', 'Admin'] } },
      { $addToSet: { perms: 'recruitment.manage' } }
    );

    return NextResponse.json({
      success: true,
      message: 'Recruitment permissions added successfully'
    });
  } catch (error) {
    console.error('Error setting up recruitment permissions:', error);
    return NextResponse.json(
      { message: 'Failed to set up recruitment permissions' },
      { status: 500 }
    );
  }
}