import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

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

// DELETE /api/dataroom/share/[id] - Revoke a share link
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid share ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

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

  } catch (error) {
    console.error('DELETE /api/dataroom/share/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/dataroom/share/[id] - Update share permissions/expiry
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid share ID' }, { status: 400 });
    }

    const body = await request.json();
    const { permissions, expiresAt } = body;

    const client = await clientPromise;
    const db = client.db('resources');

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

  } catch (error) {
    console.error('PUT /api/dataroom/share/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
