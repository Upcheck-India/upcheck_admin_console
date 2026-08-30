import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { hasPermission, PERMISSION_TYPES } from '../../../../../lib/dataroom/permission-checker';
import { withDataroomAuth } from '../../../../../lib/dataroom/withDataroomAuth';
import { AUDIENCES, PROTECTIONS } from '../../../../../lib/dataroom/share-links';

/**
 * Administering a share means administering what it shares.
 *
 * This previously resolved to the share's `roomId`, which is null for a
 * room-level share and for anything created before that field existed — so the
 * wrapper found no resource and refused the request outright. Resolving to the
 * share's own target is both correct and works for every record.
 */
async function resourceOfShare(_request, params) {
  const id = params?.id;
  if (!id || !ObjectId.isValid(id)) return null;

  const client = await clientPromise;
  const share = await client
    .db('resources')
    .collection('dataroom_shares')
    .findOne({ _id: new ObjectId(id) }, { projection: { resourceType: 1, resourceId: 1 } });

  return share?.resourceType && share?.resourceId
    ? { type: share.resourceType, id: share.resourceId.toString() }
    : null;
}

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
      },
    );

    // Sessions already minted from this link are ended too. The gate re-reads
    // the share on every request so they would fail anyway, but leaving live
    // sessions behind makes "revoked" look conditional in the data.
    await db.collection('dataroom_share_sessions').deleteMany({ shareId: new ObjectId(id) });

    await db.collection('dataroom_audit_log').insertOne({
      userId: user._id.toString(),
      userEmail: user.email,
      action: 'share_revoked',
      resourceType: share.resourceType,
      resourceId: share.resourceId,
      roomId: share.roomId || null,
      // The token is not logged: the audit log is read by more people than the
      // share list is.
      details: { shareId: id, audience: share.audience, permissions: share.permissions },
      timestamp: new Date(),
    });

    return NextResponse.json({ success: true, message: 'Share revoked successfully' });
  },
  { requires: 'admin', resolve: resourceOfShare },
);

// PUT /api/dataroom/share/[id] - Update a share link
export const PUT = withDataroomAuth(
  async (request, { user, db, params }) => {
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid share ID' }, { status: 400 });
    }

    const share = await db.collection('dataroom_shares').findOne({ _id: new ObjectId(id) });
    if (!share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      permissions,
      expiresAt,
      maxAccesses,
      audience,
      allowedEmails,
      allowedRoles,
      allowedUserIds,
      protection,
    } = body;

    const updates = {};

    if (permissions !== undefined) {
      if (!Array.isArray(permissions) || permissions.length === 0) {
        return NextResponse.json({ error: 'permissions must be a non-empty array' }, { status: 400 });
      }

      const unknown = permissions.filter((p) => !PERMISSION_TYPES.includes(p));
      if (unknown.length) {
        return NextResponse.json(
          { error: `Unknown permission(s): ${unknown.join(', ')}` },
          { status: 400 },
        );
      }

      if (permissions.includes('admin')) {
        return NextResponse.json({ error: 'Share links cannot grant "admin"' }, { status: 400 });
      }

      // The same cap the create path applies. Without it this endpoint was an
      // escalation route: create a link with `view`, then raise it here to
      // anything at all, since nothing checked what the updater held.
      for (const permission of permissions) {
        const holdsIt = await hasPermission({
          user,
          resourceType: share.resourceType,
          resourceId: share.resourceId.toString(),
          permission,
          roomId: share.roomId?.toString() || null,
        });
        if (!holdsIt) {
          return NextResponse.json(
            { error: `You cannot grant "${permission}" because you do not hold it` },
            { status: 403 },
          );
        }
      }

      updates.permissions = permissions;
    }

    if (audience !== undefined) {
      if (!AUDIENCES.includes(audience)) {
        return NextResponse.json({ error: 'Invalid audience' }, { status: 400 });
      }
      updates.audience = audience;
    }

    if (protection !== undefined) {
      if (!PROTECTIONS.includes(protection)) {
        return NextResponse.json({ error: 'Invalid protection' }, { status: 400 });
      }
      updates.protection = protection;
    }

    if (allowedEmails !== undefined) {
      updates.allowedEmails = (allowedEmails || [])
        .map((e) => String(e).toLowerCase().trim())
        .filter(Boolean);
      // The legacy single-address field is cleared when the list it was folded
      // into is rewritten, so normalizeShare never resurrects a removed
      // recipient from it.
      updates.targetEmail = null;
    }
    if (allowedRoles !== undefined) updates.allowedRoles = allowedRoles || [];
    if (allowedUserIds !== undefined) {
      updates.allowedUserIds = (allowedUserIds || []).map(String);
    }

    if (name !== undefined) updates.name = String(name).trim() || null;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (maxAccesses !== undefined) {
      updates.maxAccesses = Number.isInteger(maxAccesses) && maxAccesses > 0 ? maxAccesses : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });
    }

    const nextAudience = updates.audience ?? share.audience;
    if (nextAudience === 'restricted') {
      const emails = updates.allowedEmails ?? share.allowedEmails ?? [];
      const roles = updates.allowedRoles ?? share.allowedRoles ?? [];
      const members = updates.allowedUserIds ?? share.allowedUserIds ?? [];
      if (!emails.length && !roles.length && !members.length) {
        return NextResponse.json(
          { error: 'A restricted link must name at least one address, role or member' },
          { status: 400 },
        );
      }
    }

    updates.updatedAt = new Date();
    updates.updatedBy = {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
    };

    await db.collection('dataroom_shares').updateOne({ _id: new ObjectId(id) }, { $set: updates });

    // Narrowing a link must not leave a session minted under the old, wider
    // terms running for another twelve hours.
    if (updates.permissions || updates.audience || updates.allowedEmails || updates.protection) {
      await db.collection('dataroom_share_sessions').deleteMany({ shareId: new ObjectId(id) });
    }

    await db.collection('dataroom_audit_log').insertOne({
      userId: user._id.toString(),
      userEmail: user.email,
      action: 'share_updated',
      resourceType: share.resourceType,
      resourceId: share.resourceId,
      roomId: share.roomId || null,
      details: { shareId: id, updates: { ...updates, updatedBy: undefined } },
      timestamp: new Date(),
    });

    return NextResponse.json({ success: true, message: 'Share updated successfully' });
  },
  { requires: 'admin', resolve: resourceOfShare },
);
