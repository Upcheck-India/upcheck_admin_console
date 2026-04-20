import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit } from '../../../../lib/dataroom/audit-logger';

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

// GET /api/dataroom/user-groups - List user groups
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    const client = await clientPromise;
    const db = client.db('resources');

    const filter = { isDeleted: { $ne: true } };
    if (roomId && ObjectId.isValid(roomId)) {
      filter.roomId = new ObjectId(roomId);
    }

    const groups = await db.collection('dataroom_user_groups')
      .find(filter)
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json({ count: groups.length, items: groups });
  } catch (error) {
    console.error('GET /api/dataroom/user-groups error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/dataroom/user-groups - Create user group
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const {
      name,
      description = '',
      roomId,
      type = 'internal',
      members = [],
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    if (!['internal', 'external', 'mixed'].includes(type)) {
      return NextResponse.json({ error: 'Invalid group type' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Check for duplicate name in same room
    const existing = await db.collection('dataroom_user_groups').findOne({
      name: name.trim(),
      roomId: roomId ? new ObjectId(roomId) : null,
      isDeleted: { $ne: true },
    });

    if (existing) {
      return NextResponse.json({ error: 'A group with this name already exists' }, { status: 409 });
    }

    const newGroup = {
      name: name.trim(),
      description: description.trim(),
      roomId: roomId ? new ObjectId(roomId) : null,
      type,
      members: members.map(m => ({
        userId: m.userId || null,
        email: m.email || null,
        name: m.name || null,
        addedAt: new Date(),
        addedBy: user._id.toString(),
      })),
      isDeleted: false,
      createdAt: new Date(),
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
      updatedAt: new Date(),
    };

    const result = await db.collection('dataroom_user_groups').insertOne(newGroup);

    await logAudit({
      action: 'GROUP_CREATE',
      resourceType: 'user_group',
      resourceId: result.insertedId,
      roomId: roomId ? new ObjectId(roomId) : null,
      user,
      details: { name: newGroup.name, memberCount: members.length },
      request,
    });

    return NextResponse.json({ ...newGroup, _id: result.insertedId }, { status: 201 });

  } catch (error) {
    console.error('POST /api/dataroom/user-groups error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
