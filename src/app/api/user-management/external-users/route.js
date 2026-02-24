import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/user-management/external-users - Get all external users with optional status filter
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending_approval, active, etc.

    const client = await clientPromise;
    const db = client.db('resources');

    const query = status ? { status } : {};
    const externalUsers = await db.collection('dataroom_external_users')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      users: externalUsers,
      count: externalUsers.length,
    });

  } catch (error) {
    console.error('GET /api/user-management/external-users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/user-management/external-users/approve - Approve external user
export async function POST(request) {
  try {
    const { userId, action } = await request.json(); // action: 'approve' or 'reject'

    if (!userId || !action) {
      return NextResponse.json({ error: 'User ID and action are required' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('dataroom_external_users').findOne({
      _id: new ObjectId(userId)
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (action === 'approve') {
      await db.collection('dataroom_external_users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            status: 'active',
            approvedAt: new Date(),
            updatedAt: new Date(),
          }
        }
      );

      // TODO: Send approval email notification to user
      
      return NextResponse.json({
        success: true,
        message: 'User approved successfully',
      });
    } else {
      await db.collection('dataroom_external_users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            status: 'rejected',
            rejectedAt: new Date(),
            updatedAt: new Date(),
          }
        }
      );

      // TODO: Send rejection email notification to user
      
      return NextResponse.json({
        success: true,
        message: 'User rejected successfully',
      });
    }

  } catch (error) {
    console.error('POST /api/user-management/external-users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
