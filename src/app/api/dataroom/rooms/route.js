import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../lib/dataroom/audit-logger';

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

// Room types
const ROOM_TYPES = ['general', 'ma', 'fundraising', 'audit', 'legal', 'custom'];

// GET /api/dataroom/rooms - List rooms
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const includeExpired = searchParams.get('includeExpired') === 'true';

    const filter = { isDeleted: { $ne: true } };

    // Admins see all rooms, others see only their accessible rooms
    if (!isAdminLike(user)) {
      // Get rooms where user has permission or is owner
      const permissions = await db.collection('dataroom_permissions')
        .find({
          resourceType: 'room',
          $or: [
            { userId: user._id.toString() },
            { userEmail: user.email },
          ],
        })
        .toArray();

      const permittedRoomIds = permissions.map(p => new ObjectId(p.resourceId));
      filter.$or = [
        { _id: { $in: permittedRoomIds } },
        { ownerId: user._id.toString() },
      ];
    }

    if (type && ROOM_TYPES.includes(type)) {
      filter.type = type;
    }

    if (!includeExpired) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      });
    }

    const rooms = await db.collection('dataroom_rooms')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({ count: rooms.length, items: rooms });
  } catch (error) {
    console.error('GET /api/dataroom/rooms error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/dataroom/rooms - Create a new room
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const {
      name,
      description = '',
      type = 'general',
      expiresAt = null,
      requireNda = false,
      ndaDocumentId = null,
      ipWhitelist = [],
      branding = {},
      settings = {},
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }

    if (!ROOM_TYPES.includes(type)) {
      return NextResponse.json({ error: `Invalid room type. Must be one of: ${ROOM_TYPES.join(', ')}` }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Check for duplicate name
    const existing = await db.collection('dataroom_rooms').findOne({
      name: name.trim(),
      isDeleted: { $ne: true },
    });

    if (existing) {
      return NextResponse.json({ error: 'A room with this name already exists' }, { status: 409 });
    }

    const roomId = new ObjectId();
    const newRoom = {
      _id: roomId,
      name: name.trim(),
      description: description.trim(),
      type,
      ownerId: user._id.toString(),
      ownerEmail: user.email,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      requireNda,
      ndaDocumentId: ndaDocumentId ? new ObjectId(ndaDocumentId) : null,
      ipWhitelist: Array.isArray(ipWhitelist) ? ipWhitelist : [],
      branding: {
        logo: branding.logo || null,
        primaryColor: branding.primaryColor || '#4F46E5',
        companyName: branding.companyName || null,
      },
      settings: {
        allowDownload: settings.allowDownload !== false,
        allowPrint: settings.allowPrint !== false,
        enableWatermark: settings.enableWatermark || false,
        enableQA: settings.enableQA || false,
      },
      isLocked: false,
      isDeleted: false,
      createdAt: new Date(),
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
      updatedAt: new Date(),
    };

    await db.collection('dataroom_rooms').insertOne(newRoom);

    // Create root folder for the room
    await db.collection('dataroom_folders').insertOne({
      roomId,
      name: 'Root',
      path: '/',
      parentId: null,
      createdAt: new Date(),
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
      meta: {},
      isDeleted: false,
    });

    await logAudit({
      action: AUDIT_ACTIONS.ROOM_CREATE,
      resourceType: 'room',
      resourceId: roomId,
      roomId,
      user,
      details: { name: newRoom.name, type: newRoom.type },
      request,
    });

    return NextResponse.json(newRoom, { status: 201 });

  } catch (error) {
    console.error('POST /api/dataroom/rooms error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
