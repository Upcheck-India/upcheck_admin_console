import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { clerkClient } from '@clerk/nextjs/server';

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

// POST /api/user-management/external-users - Approve or reject external user
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

// DELETE /api/user-management/external-users - Delete external user from both MongoDB and Clerk
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const clerkId = searchParams.get('clerkId');
    const deleteFromClerk = searchParams.get('deleteFromClerk') === 'true';

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Find the user in MongoDB
    const user = await db.collection('dataroom_external_users').findOne({
      _id: new ObjectId(userId)
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found in MongoDB' }, { status: 404 });
    }

    // Get Clerk ID from user record or from query param
    const userClerkId = clerkId || user.clerkId;

    // Delete from Clerk if requested and clerkId exists
    if (deleteFromClerk && userClerkId) {
      try {
        await clerkClient.users.deleteUser(userClerkId);
        console.log(`Deleted user ${userClerkId} from Clerk`);
      } catch (clerkError) {
        // User might not exist in Clerk anymore, log but continue with MongoDB deletion
        console.warn(`Could not delete from Clerk (user may not exist): ${userClerkId}`, clerkError);
      }
    }

    // Delete from MongoDB
    await db.collection('dataroom_external_users').deleteOne({
      _id: new ObjectId(userId)
    });

    console.log(`Deleted user ${userId} from MongoDB`);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
      deletedFromClerk: deleteFromClerk && userClerkId,
    });

  } catch (error) {
    console.error('DELETE /api/user-management/external-users error:', error);
    return NextResponse.json({
      error: 'Internal Server Error',
      details: error.message
    }, { status: 500 });
  }
}
