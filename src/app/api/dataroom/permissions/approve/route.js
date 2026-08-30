import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth, resourceFromBody } from '../../../../../lib/dataroom/withDataroomAuth';

// POST /api/dataroom/permissions/approve - Approve or reject access request
export const POST = withDataroomAuth(
  async (request, { user, db, params }) => {

    const body = await request.json();
    const { requestId, action, expiryDate, notes } = body;

    // Validation
    if (!requestId || !ObjectId.isValid(requestId)) {
      return NextResponse.json({ error: 'Valid requestId required' }, { status: 400 });
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
    }

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
  },
  {
    requires: 'admin',
    resolve: resourceFromBody('resourceType', 'resourceId'),
  },
);
