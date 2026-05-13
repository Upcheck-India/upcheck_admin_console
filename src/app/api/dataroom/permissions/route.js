import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../lib/dataroom/audit-logger';
import { grantPermission, getResourcePermissions } from '../../../../lib/dataroom/permission-checker';

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

// GET /api/dataroom/permissions - Get permissions for a resource
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'resourceType and resourceId are required' }, { status: 400 });
    }

    if (!['room', 'folder', 'document'].includes(resourceType)) {
      return NextResponse.json({ error: 'Invalid resourceType' }, { status: 400 });
    }

    const permissions = await getResourcePermissions(resourceType, resourceId);

    return NextResponse.json({
      resourceType,
      resourceId,
      count: permissions.length,
      permissions,
    });
  } catch (error) {
    console.error('GET /api/dataroom/permissions error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/dataroom/permissions - Grant permission
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const {
      resourceType,
      resourceId,
      roomId,
      userId,
      userEmail,
      groupId,
      teamId,
      permissions,
      expiresAt,
    } = body;

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'resourceType and resourceId are required' }, { status: 400 });
    }

    if (!['room', 'folder', 'document'].includes(resourceType)) {
      return NextResponse.json({ error: 'Invalid resourceType' }, { status: 400 });
    }

    if (!userId && !userEmail && !groupId && !teamId) {
      return NextResponse.json({ error: 'Either userId, userEmail, groupId, or teamId is required' }, { status: 400 });
    }

    if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
      return NextResponse.json({ error: 'permissions array is required' }, { status: 400 });
    }

    const validPermissions = new Set(['view', 'comment', 'edit', 'download', 'print', 'admin']);
    const invalidPerms = permissions.filter(p => !validPermissions.has(p));
    if (invalidPerms.length > 0) {
      return NextResponse.json({ error: `Invalid permissions: ${invalidPerms.join(', ')}` }, { status: 400 });
    }

    const result = await grantPermission({
      resourceType,
      resourceId,
      roomId,
      userId,
      userEmail,
      groupId,
      teamId,
      permissions,
      expiresAt,
      grantedBy: user,
    });

    await logAudit({
      action: AUDIT_ACTIONS.PERMISSION_GRANT,
      resourceType,
      resourceId,
      roomId,
      user,
      details: {
        targetUserId: userId,
        targetUserEmail: userEmail,
        targetGroupId: groupId,
        targetTeamId: teamId,
        permissions,
        expiresAt,
      },
      request,
    });

    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    console.error('POST /api/dataroom/permissions error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/dataroom/permissions - Revoke permission
export async function DELETE(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const permissionId = searchParams.get('id');

    if (!permissionId || !ObjectId.isValid(permissionId)) {
      return NextResponse.json({ error: 'Valid permission id is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const permission = await db.collection('dataroom_permissions').findOne({
      _id: new ObjectId(permissionId),
    });

    if (!permission) {
      return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
    }

    await db.collection('dataroom_permissions').deleteOne({
      _id: new ObjectId(permissionId),
    });

    await logAudit({
      action: AUDIT_ACTIONS.PERMISSION_REVOKE,
      resourceType: permission.resourceType,
      resourceId: permission.resourceId,
      roomId: permission.roomId,
      user,
      details: {
        revokedPermissionId: permissionId,
        targetUserId: permission.userId,
        targetUserEmail: permission.userEmail,
        targetGroupId: permission.groupId,
        targetTeamId: permission.teamId,
      },
      request,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/dataroom/permissions error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
