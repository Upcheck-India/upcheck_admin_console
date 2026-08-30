import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { hasPermission, PERMISSION_TYPES } from '../../../../lib/dataroom/permission-checker';
import { withDataroomAuth } from '../../../../lib/dataroom/withDataroomAuth';
import {
  AUDIENCES,
  PROTECTIONS,
  SHAREABLE_RESOURCE_TYPES,
  normalizeShare,
} from '../../../../lib/dataroom/share-links';

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
      .find({ resourceType, resourceId: new ObjectId(resourceId) })
      .sort({ createdAt: -1 })
      .toArray();

    // Normalised on the way out so the editor renders one model rather than
    // having to know what old records omitted.
    return NextResponse.json({ shares: shares.map(normalizeShare) });
  },
  { requires: 'admin', resolve: resourceFromQuery },
);

// POST /api/dataroom/share - Create a share link
//
// `admin` on the resource is enforced by the wrapper, and the delegated
// permissions are capped to what the sharer holds below.
export const POST = withDataroomAuth(
  async (request, { user, db }) => {
    const body = await request.json();
    const {
      resourceType,
      resourceId,
      roomId,
      name,
      permissions,
      expiresAt,
      maxAccesses,
      // Audience — who the link admits.
      audience = 'restricted',
      allowedEmails = [],
      allowedRoles = [],
      allowedUserIds = [],
      // Protection — what a visitor must prove.
      protection = 'collect_email',
      // Accepted for older callers; folded into allowedEmails below.
      targetEmail,
    } = body;

    if (!resourceType || !resourceId || !ObjectId.isValid(resourceId)) {
      return NextResponse.json({ error: 'Valid resourceType and resourceId required' }, { status: 400 });
    }

    if (!SHAREABLE_RESOURCE_TYPES.includes(resourceType)) {
      return NextResponse.json({ error: 'Invalid resourceType' }, { status: 400 });
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return NextResponse.json({ error: 'permissions required' }, { status: 400 });
    }

    const unknownPermissions = permissions.filter((p) => !PERMISSION_TYPES.includes(p));
    if (unknownPermissions.length) {
      return NextResponse.json(
        { error: `Unknown permission(s): ${unknownPermissions.join(', ')}` },
        { status: 400 },
      );
    }

    if (permissions.includes('admin')) {
      // A link is a bearer credential. Handing out the ability to re-share and
      // re-permission a resource through one is not something to do by
      // accident, so it is not something this endpoint does at all.
      return NextResponse.json(
        { error: 'Share links cannot grant "admin"' },
        { status: 400 },
      );
    }

    if (!AUDIENCES.includes(audience)) {
      return NextResponse.json({ error: 'Invalid audience' }, { status: 400 });
    }

    if (!PROTECTIONS.includes(protection)) {
      return NextResponse.json({ error: 'Invalid protection' }, { status: 400 });
    }

    const emails = [...allowedEmails, ...(targetEmail ? [targetEmail] : [])]
      .map((e) => String(e).toLowerCase().trim())
      .filter(Boolean);

    if (
      audience === 'restricted' &&
      !emails.length &&
      !allowedRoles.length &&
      !allowedUserIds.length
    ) {
      // A restricted link naming nobody admits nobody. That is more likely a
      // half-filled form than an intention, and failing here is kinder than
      // issuing a link that silently never works.
      return NextResponse.json(
        { error: 'A restricted link must name at least one address, role or member' },
        { status: 400 },
      );
    }

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

    const shareToken = crypto.randomBytes(32).toString('hex');

    const shareDoc = {
      shareToken,
      resourceType,
      resourceId: new ObjectId(resourceId),
      roomId: roomId ? new ObjectId(roomId) : null,
      name: (name || '').trim() || null,
      audience,
      allowedEmails: emails,
      allowedRoles,
      allowedUserIds: allowedUserIds.map(String),
      protection,
      permissions,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      maxAccesses: Number.isInteger(maxAccesses) && maxAccesses > 0 ? maxAccesses : null,
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      revokedAt: null,
      accessCount: 0,
      lastAccessedAt: null,
    };

    const result = await db.collection('dataroom_shares').insertOne(shareDoc);

    await db.collection('dataroom_audit_log').insertOne({
      userId: user._id.toString(),
      userEmail: user.email,
      action: 'share_created',
      resourceType,
      resourceId: new ObjectId(resourceId),
      roomId: shareDoc.roomId,
      details: {
        // The token itself is not logged. The audit log is read by more people
        // than the share list is, and a logged token is a working credential.
        shareId: result.insertedId.toString(),
        audience,
        protection,
        permissions,
        recipientCount: emails.length + allowedRoles.length + allowedUserIds.length,
        expiresAt,
      },
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      shareId: result.insertedId,
      shareToken,
      url: `/dataroom/shared/${shareToken}`,
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
