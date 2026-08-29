import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { withDataroomAuth, roomOf } from '../../../../../lib/dataroom/withDataroomAuth';

// DELETE /api/dataroom/share/[id] - Revoke a share link
export const DELETE = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid share ID' }, { status: 400 });
    }

    const share = await db.collection('dataroom_shares').findOne({ _id: new ObjectId(id) });
    if (!share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    // Update share to mark as revoked
    await db.collection('dataroom_shares').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          revokedAt: new Date(),
          revokedBy: {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
          },
        },
      }
    );

    // Log audit event
    await db.collection('dataroom_audit_log').insertOne({
      userId: user._id.toString(),
      userEmail: user.email,
      action: 'share_revoked',
      resourceType: share.resourceType,
      resourceId: share.resourceId,
      details: {
        shareId: id,
        shareToken: share.shareToken,
        targetEmail: share.targetEmail,
      },
      timestamp: new Date(),
    });

    return NextResponse.json({ success: true, message: 'Share revoked successfully' });
  },
  {
    requires: 'admin',
    resolve: roomOf('dataroom_shares', 'id'),
  },
);

// PUT /api/dataroom/share/[id] - Update share permissions/expiry
export const PUT = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid share ID' }, { status: 400 });
    }

    const body = await request.json();
    const { permissions, expiresAt } = body;

    const share = await db.collection('dataroom_shares').findOne({ _id: new ObjectId(id) });
    if (!share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    const updateFields = {};
    if (permissions && Array.isArray(permissions)) {
      updateFields.permissions = permissions;
    }
    if (expiresAt !== undefined) {
      updateFields.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });
    }

    updateFields.updatedAt = new Date();
    updateFields.updatedBy = {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
    };

    await db.collection('dataroom_shares').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    // Log audit event
    await db.collection('dataroom_audit_log').insertOne({
      userId: user._id.toString(),
      userEmail: user.email,
      action: 'share_updated',
      resourceType: share.resourceType,
      resourceId: share.resourceId,
      details: {
        shareId: id,
        updates: updateFields,
      },
      timestamp: new Date(),
    });

    return NextResponse.json({ success: true, message: 'Share updated successfully' });
  },
  {
    requires: 'admin',
    resolve: roomOf('dataroom_shares', 'id'),
  },
);
