import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { withDataroomAuth, ADMIN_ROLES } from '../../../../../../lib/dataroom/withDataroomAuth';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';

// POST /api/dataroom/permissions/[id]/expiry - Set access expiry date
export const POST = withDataroomAuth(
  async (request, { user, params }) => {
  try {

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid permission ID' }, { status: 400 });
    }

    const body = await request.json();
    const { expiryDate, autoRevoke = true } = body;

    if (!expiryDate) {
      return NextResponse.json({ error: 'expiryDate is required' }, { status: 400 });
    }

    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) {
      return NextResponse.json({ error: 'Invalid expiry date format' }, { status: 400 });
    }

    if (expiry <= new Date()) {
      return NextResponse.json({ error: 'Expiry date must be in the future' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Get the permission
    const permission = await db.collection('dataroom_permissions').findOne({
      _id: new ObjectId(id),
      isRevoked: { $ne: true },
    });

    if (!permission) {
      return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
    }

    // Update permission with expiry
    const result = await db.collection('dataroom_permissions').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          expiryDate: expiry,
          autoRevoke,
          updatedAt: new Date(),
          updatedBy: {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
          },
        },
      }
    );

    await logAudit({
      action: AUDIT_ACTIONS.PERMISSION_EXPIRY_SET,
      resourceType: 'permission',
      resourceId: new ObjectId(id),
      user,
      details: {
        targetType: permission.targetType,
        targetId: permission.targetId.toString(),
        granteeType: permission.granteeType,
        granteeId: permission.granteeId,
        expiryDate: expiry.toISOString(),
        autoRevoke,
      },
      request,
    });

    return NextResponse.json({
      message: 'Access expiry set successfully',
      expiryDate: expiry,
      autoRevoke,
      updated: result.modifiedCount > 0,
    });

  } catch (error) {
    console.error('POST /api/dataroom/permissions/[id]/expiry error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
},
  { roles: ADMIN_ROLES },
);

// DELETE /api/dataroom/permissions/[id]/expiry - Remove access expiry
export const DELETE = withDataroomAuth(
  async (request, { user, params }) => {
  try {

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid permission ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Get the permission
    const permission = await db.collection('dataroom_permissions').findOne({
      _id: new ObjectId(id),
    });

    if (!permission) {
      return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
    }

    // Remove expiry
    const result = await db.collection('dataroom_permissions').updateOne(
      { _id: new ObjectId(id) },
      {
        $unset: {
          expiryDate: '',
          autoRevoke: '',
        },
        $set: {
          updatedAt: new Date(),
          updatedBy: {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
          },
        },
      }
    );

    await logAudit({
      action: AUDIT_ACTIONS.PERMISSION_EXPIRY_REMOVED,
      resourceType: 'permission',
      resourceId: new ObjectId(id),
      user,
      details: {
        targetType: permission.targetType,
        targetId: permission.targetId.toString(),
      },
      request,
    });

    return NextResponse.json({
      message: 'Access expiry removed successfully',
      removed: result.modifiedCount > 0,
    });

  } catch (error) {
    console.error('DELETE /api/dataroom/permissions/[id]/expiry error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
},
  { roles: ADMIN_ROLES },
);
