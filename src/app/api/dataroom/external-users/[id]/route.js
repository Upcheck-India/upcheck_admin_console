import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit } from '../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth, roomOf } from '../../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/external-users/[id] - Get external user details
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid external user ID' }, { status: 400 });
    }

    const externalUser = await db.collection('dataroom_external_users').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!externalUser) {
      return NextResponse.json({ error: 'External user not found' }, { status: 404 });
    }

    // Don't expose sensitive tokens
    return NextResponse.json({
      ...externalUser,
      accessToken: undefined,
      inviteToken: undefined,
    });
  },
  {
    requires: 'admin',
    resolve: roomOf('dataroom_external_users', 'id'),
  },
);

// PUT /api/dataroom/external-users/[id] - Update external user
export const PUT = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid external user ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, organization, role, expiresAt, status } = body;

    const externalUser = await db.collection('dataroom_external_users').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!externalUser) {
      return NextResponse.json({ error: 'External user not found' }, { status: 404 });
    }

    const updates = { updatedAt: new Date() };

    if (name !== undefined) updates.name = name?.trim() || null;
    if (organization !== undefined) updates.organization = organization?.trim() || null;
    if (role !== undefined) updates.role = role;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (status !== undefined && ['invited', 'active', 'revoked'].includes(status)) {
      updates.status = status;
      if (status === 'revoked') {
        updates.revokedAt = new Date();
        updates.revokedBy = {
          id: user._id.toString(),
          email: user.email,
        };
      }
    }

    await db.collection('dataroom_external_users').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    await logAudit({
      action: 'EXTERNAL_USER_UPDATE',
      resourceType: 'external_user',
      resourceId: id,
      roomId: externalUser.roomId,
      user,
      details: { updates: Object.keys(updates), email: externalUser.email },
      request,
    });

    const updated = await db.collection('dataroom_external_users').findOne({ _id: new ObjectId(id) });
    
    return NextResponse.json({
      ...updated,
      accessToken: undefined,
      inviteToken: undefined,
    });
  },
  {
    requires: 'admin',
    resolve: roomOf('dataroom_external_users', 'id'),
  },
);

// DELETE /api/dataroom/external-users/[id] - Revoke access
export const DELETE = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid external user ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    const externalUser = await db.collection('dataroom_external_users').findOne({
      _id: new ObjectId(id),
    });

    if (!externalUser) {
      return NextResponse.json({ error: 'External user not found' }, { status: 404 });
    }

    if (permanent) {
      await db.collection('dataroom_external_users').deleteOne({ _id: new ObjectId(id) });
    } else {
      await db.collection('dataroom_external_users').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'revoked',
            isDeleted: true,
            revokedAt: new Date(),
            revokedBy: {
              id: user._id.toString(),
              email: user.email,
            },
            deletedAt: new Date(),
          },
        }
      );
    }

    await logAudit({
      action: 'EXTERNAL_USER_REVOKE',
      resourceType: 'external_user',
      resourceId: id,
      roomId: externalUser.roomId,
      user,
      details: { permanent, email: externalUser.email },
      request,
    });

    return NextResponse.json({ success: true, permanent });
  },
  {
    requires: 'admin',
    resolve: roomOf('dataroom_external_users', 'id'),
  },
);
