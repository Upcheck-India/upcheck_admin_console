import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../lib/dataroom/audit-logger';
import { checkRoomAccess } from '../../../../../lib/dataroom/permission-checker';

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

// GET /api/dataroom/rooms/[id] - Get single room
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
    }

    const access = await checkRoomAccess(user, id);
    if (!access.allowed) {
      if (access.requireNda) {
        return NextResponse.json({ error: access.reason, requireNda: true }, { status: 403 });
      }
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const room = await db.collection('dataroom_rooms').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Log room access
    await logAudit({
      action: AUDIT_ACTIONS.ROOM_ACCESS,
      resourceType: 'room',
      resourceId: id,
      roomId: id,
      user,
      details: {},
      request,
    });

    return NextResponse.json(room);
  } catch (error) {
    console.error('GET /api/dataroom/rooms/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/dataroom/rooms/[id] - Update room
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      description,
      expiresAt,
      requireNda,
      ndaDocumentId,
      ipWhitelist,
      branding,
      settings,
      isLocked,
    } = body;

    const client = await clientPromise;
    const db = client.db('resources');

    const room = await db.collection('dataroom_rooms').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Only owner or admin can update
    if (!isAdminLike(user) && room.ownerId !== user._id.toString()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updates = { updatedAt: new Date() };

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (requireNda !== undefined) updates.requireNda = !!requireNda;
    if (ndaDocumentId !== undefined) {
      updates.ndaDocumentId = ndaDocumentId ? new ObjectId(ndaDocumentId) : null;
    }
    if (ipWhitelist !== undefined) updates.ipWhitelist = Array.isArray(ipWhitelist) ? ipWhitelist : [];
    if (branding !== undefined) updates.branding = { ...room.branding, ...branding };
    if (settings !== undefined) updates.settings = { ...room.settings, ...settings };
    if (isLocked !== undefined) updates.isLocked = !!isLocked;

    await db.collection('dataroom_rooms').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    await logAudit({
      action: AUDIT_ACTIONS.ROOM_UPDATE,
      resourceType: 'room',
      resourceId: id,
      roomId: id,
      user,
      details: { updates: Object.keys(updates) },
      request,
    });

    const updatedRoom = await db.collection('dataroom_rooms').findOne({ _id: new ObjectId(id) });
    return NextResponse.json(updatedRoom);

  } catch (error) {
    console.error('PUT /api/dataroom/rooms/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/dataroom/rooms/[id] - Delete room
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    const client = await clientPromise;
    const db = client.db('resources');

    const room = await db.collection('dataroom_rooms').findOne({
      _id: new ObjectId(id),
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Only owner or admin can delete
    if (!isAdminLike(user) && room.ownerId !== user._id.toString()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const roomOid = new ObjectId(id);

    if (permanent) {
      // Hard delete everything
      await db.collection('dataroom_documents').deleteMany({ roomId: roomOid });
      await db.collection('dataroom_folders').deleteMany({ roomId: roomOid });
      await db.collection('dataroom_permissions').deleteMany({ roomId: id });
      await db.collection('dataroom_comments').deleteMany({ roomId: roomOid });
      await db.collection('dataroom_qa').deleteMany({ roomId: roomOid });
      await db.collection('dataroom_rooms').deleteOne({ _id: roomOid });
    } else {
      // Soft delete
      const now = new Date();
      await db.collection('dataroom_rooms').updateOne(
        { _id: roomOid },
        { $set: { isDeleted: true, deletedAt: now, deletedBy: user._id.toString() } }
      );
    }

    await logAudit({
      action: AUDIT_ACTIONS.ROOM_DELETE,
      resourceType: 'room',
      resourceId: id,
      roomId: id,
      user,
      details: { permanent, name: room.name },
      request,
    });

    return NextResponse.json({ success: true, permanent });

  } catch (error) {
    console.error('DELETE /api/dataroom/rooms/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
