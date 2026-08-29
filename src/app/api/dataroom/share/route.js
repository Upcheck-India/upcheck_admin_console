import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { hasPermission, PERMISSION_TYPES } from '../../../../lib/dataroom/permission-checker';
import { withDataroomAuth } from '../../../../lib/dataroom/withDataroomAuth';

const SHAREABLE_RESOURCE_TYPES = ['document', 'folder', 'room'];

/**
 * Both handlers act on a resource named by (resourceType, resourceId) rather
 * than by a route param, so the type is resolved dynamically. The wrapper
 * rejects any type outside its known set, so an unexpected value fails closed.
 */
function resourceFromQuery(request) {
  const sp = new URL(request.url).searchParams;
  const type = sp.get('resourceType');
  const id = sp.get('resourceId');
  return type && id ? { type, id } : null;
}

// GET /api/dataroom/share - List shares for a resource
//
// These records contain live `shareToken` values — listing them was previously
// open to any authenticated account for any resource, which handed out working
// access tokens on request. `admin` on the resource is now required.
export const GET = withDataroomAuth(
  async (request, { db }) => {
    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');

    if (!resourceType || !resourceId || !ObjectId.isValid(resourceId)) {
      return NextResponse.json({ error: 'Valid resourceType and resourceId required' }, { status: 400 });
    }

    const shares = await db.collection('dataroom_shares')
      .find({
        resourceType,
        resourceId: new ObjectId(resourceId),
      })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ shares });
  },
  { requires: 'admin', resolve: resourceFromQuery },
);

// POST /api/dataroom/share - Create a new share link
//
// Previously created a working share token for any resourceId supplied, for any
// authenticated caller. `admin` on the resource is now required by the wrapper,
// and the delegated permissions are capped to what the sharer holds below.
export const POST = withDataroomAuth(
  async (request, { user, db }) => {
    const body = await request.json();
    const { resourceType, resourceId, roomId, targetEmail, permissions, expiresAt } = body;

    if (!resourceType || !resourceId || !ObjectId.isValid(resourceId)) {
      return NextResponse.json({ error: 'Valid resourceType and resourceId required' }, { status: 400 });
    }

    if (!targetEmail || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ error: 'targetEmail and permissions required' }, { status: 400 });
    }

    if (!SHAREABLE_RESOURCE_TYPES.includes(resourceType)) {
      return NextResponse.json({ error: 'Invalid resourceType' }, { status: 400 });
    }

    const unknownPermissions = permissions.filter((p) => !PERMISSION_TYPES.includes(p));
    if (unknownPermissions.length) {
      return NextResponse.json(
        { error: `Unknown permission(s): ${unknownPermissions.join(', ')}` },
        { status: 400 },
      );
    }

    // `admin` on the resource is enforced by the wrapper.
    //
    // A share must never grant more than the sharer holds. Administering the
    // resource implies all of them today, but checking each delegated
    // permission explicitly means this stays correct if sharing is later opened
    // up to non-administrators.
    for (const permission of permissions) {
      const holdsIt = await hasPermission({
        user,
        resourceType,
        resourceId,
        permission,
        roomId: roomId || null,
      });
      if (!holdsIt) {
        return NextResponse.json(
          { error: `You cannot grant "${permission}" because you do not hold it` },
          { status: 403 },
        );
      }
    }

    // Generate unique share token
    const shareToken = crypto.randomBytes(32).toString('hex');

    // Create share record
    const shareDoc = {
      shareToken,
      resourceType,
      resourceId: new ObjectId(resourceId),
      roomId: roomId ? new ObjectId(roomId) : null,
      targetEmail: targetEmail.toLowerCase(),
      permissions,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
      createdAt: new Date(),
      revokedAt: null,
      accessCount: 0,
      lastAccessedAt: null,
    };

    const result = await db.collection('dataroom_shares').insertOne(shareDoc);

    // Log audit event
    await db.collection('dataroom_audit_log').insertOne({
      userId: user._id.toString(),
      userEmail: user.email,
      action: 'share_created',
      resourceType,
      resourceId: new ObjectId(resourceId),
      details: {
        targetEmail,
        permissions,
        shareToken,
        expiresAt,
      },
      timestamp: new Date(),
    });

    // TODO: Send email invitation with share link
    // For now, return the share token so it can be copied

    return NextResponse.json({
      success: true,
      shareId: result.insertedId,
      shareToken,
      message: 'Share link created successfully',
    });
  },
  {
    requires: 'admin',
    // resourceType/resourceId arrive in the JSON body; read a clone so the
    // handler can still consume the request stream itself.
    resolve: async (request) => {
      const body = await request.clone().json().catch(() => ({}));
      return body?.resourceType && body?.resourceId
        ? { type: String(body.resourceType), id: String(body.resourceId) }
        : null;
    },
  },
);
