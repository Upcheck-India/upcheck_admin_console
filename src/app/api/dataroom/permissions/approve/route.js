import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../lib/dataroom/audit-logger';

async function getUserFromToken(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, username: 1, role: 1 } }
    );
    return user;
  } catch {
    return null;
  }
}

function isAdminLike(user) {
  return user && (user.role === 'Admin' || user.role === 'Console admin');
}

// POST /api/dataroom/permissions/approve - Approve or reject access request
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user || !isAdminLike(user)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    const body = await request.json();
    const { requestId, action, expiryDate, notes } = body;

    // Validation
    if (!requestId || !ObjectId.isValid(requestId)) {
      return NextResponse.json({ error: 'Valid requestId required' }, { status: 400 });
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Get the access request
    const accessRequest = await db.collection('dataroom_access_requests').findOne({
      _id: new ObjectId(requestId),
      status: 'pending',
    });

    if (!accessRequest) {
      return NextResponse.json({ error: 'Access request not found or already processed' }, { status: 404 });
    }

    if (action === 'approve') {
      // Create permission
      const permission = {
        targetType: accessRequest.targetType,
        targetId: accessRequest.targetId,
        granteeType: 'user',
        granteeId: accessRequest.requesterId.toString(),
        permissionLevel: accessRequest.permissionLevel,
        grantedBy: {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
        },
        grantedAt: new Date(),
        createdAt: new Date(),
      };

      // Add expiry if provided
      if (expiryDate) {
        const expiry = new Date(expiryDate);
        if (!isNaN(expiry.getTime()) && expiry > new Date()) {
          permission.expiryDate = expiry;
          permission.autoRevoke = true;
        }
      }

      const permResult = await db.collection('dataroom_permissions').insertOne(permission);

      // Update request status
      await db.collection('dataroom_access_requests').updateOne(
        { _id: new ObjectId(requestId) },
        {
          $set: {
            status: 'approved',
            approvedBy: {
              id: user._id.toString(),
              email: user.email,
              username: user.username,
            },
            approvedAt: new Date(),
            notes: notes || '',
            permissionId: permResult.insertedId,
            updatedAt: new Date(),
          },
        }
      );

      await logAudit({
        action: AUDIT_ACTIONS.ACCESS_APPROVED,
        resourceType: accessRequest.targetType,
        resourceId: accessRequest.targetId,
        user,
        details: {
          requestId: requestId,
          requesterEmail: accessRequest.requesterEmail,
          permissionLevel: accessRequest.permissionLevel,
          permissionId: permResult.insertedId,
          expiryDate: expiryDate || null,
        },
        request,
      });

      return NextResponse.json({
        message: 'Access request approved successfully',
        permission: {
          ...permission,
          _id: permResult.insertedId,
        },
      });

    } else {
      // Reject request
      await db.collection('dataroom_access_requests').updateOne(
        { _id: new ObjectId(requestId) },
        {
          $set: {
            status: 'rejected',
            rejectedBy: {
              id: user._id.toString(),
              email: user.email,
              username: user.username,
            },
            rejectedAt: new Date(),
            notes: notes || '',
            updatedAt: new Date(),
          },
        }
      );

      await logAudit({
        action: AUDIT_ACTIONS.ACCESS_REJECTED,
        resourceType: accessRequest.targetType,
        resourceId: accessRequest.targetId,
        user,
        details: {
          requestId: requestId,
          requesterEmail: accessRequest.requesterEmail,
          permissionLevel: accessRequest.permissionLevel,
          reason: notes,
        },
        request,
      });

      return NextResponse.json({
        message: 'Access request rejected',
      });
    }

  } catch (error) {
    console.error('POST /api/dataroom/permissions/approve error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
