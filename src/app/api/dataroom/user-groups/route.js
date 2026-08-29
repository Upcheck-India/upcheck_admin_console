import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit } from '../../../../lib/dataroom/audit-logger';
import { withDataroomAuth } from '../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/user-groups - List user groups
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    const filter = { isDeleted: { $ne: true } };
    if (roomId && ObjectId.isValid(roomId)) {
      filter.roomId = new ObjectId(roomId);
    }

    const groups = await db.collection('dataroom_user_groups')
      .find(filter)
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json({ count: groups.length, items: groups });
  },
  {
    requires: 'admin',
    resource: { type: 'room', query: 'roomId' },
  },
);

// POST /api/dataroom/user-groups - Create user group
export const POST = withDataroomAuth(
  async (request, { user, db, params }) => {

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
  },
  {
    requires: 'admin',
    resource: { type: 'room', query: 'roomId' },
  },
);
