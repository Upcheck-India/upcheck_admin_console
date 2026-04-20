import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit } from '../../../../../lib/dataroom/audit-logger';

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

// GET /api/dataroom/user-groups/[id] - Get single user group
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const group = await db.collection('dataroom_user_groups').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'User group not found' }, { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error('GET /api/dataroom/user-groups/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/dataroom/user-groups/[id] - Update user group
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, members, addMembers, removeMembers } = body;

    const client = await clientPromise;
    const db = client.db('resources');

    const group = await db.collection('dataroom_user_groups').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'User group not found' }, { status: 404 });
    }

    const updates = { updatedAt: new Date() };

    if (name !== undefined) {
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description.trim();
    }

    // Handle full member replacement
    if (members !== undefined && Array.isArray(members)) {
      updates.members = members.map(m => ({
        userId: m.userId || null,
        email: m.email || null,
        name: m.name || null,
        addedAt: m.addedAt || new Date(),
        addedBy: m.addedBy || user._id.toString(),
      }));
    }

    // Handle adding specific members
    if (addMembers && Array.isArray(addMembers) && addMembers.length > 0) {
      const newMembers = addMembers.map(m => ({
        userId: m.userId || null,
        email: m.email || null,
        name: m.name || null,
        addedAt: new Date(),
        addedBy: user._id.toString(),
      }));

      await db.collection('dataroom_user_groups').updateOne(
        { _id: new ObjectId(id) },
        { $push: { members: { $each: newMembers } } }
      );
    }

    // Handle removing specific members
    if (removeMembers && Array.isArray(removeMembers) && removeMembers.length > 0) {
      // Remove by userId or email
      await db.collection('dataroom_user_groups').updateOne(
        { _id: new ObjectId(id) },
        {
          $pull: {
            members: {
              $or: removeMembers.map(m => ({
                ...(m.userId && { userId: m.userId }),
                ...(m.email && { email: m.email }),
              })),
            },
          },
        }
      );
    }

    // Apply other updates
    if (Object.keys(updates).length > 1) { // More than just updatedAt
      await db.collection('dataroom_user_groups').updateOne(
        { _id: new ObjectId(id) },
        { $set: updates }
      );
    }

    await logAudit({
      action: 'GROUP_UPDATE',
      resourceType: 'user_group',
      resourceId: id,
      roomId: group.roomId,
      user,
      details: {
        updates: Object.keys(updates),
        addedMembers: addMembers?.length || 0,
        removedMembers: removeMembers?.length || 0,
      },
      request,
    });

    const updatedGroup = await db.collection('dataroom_user_groups').findOne({ _id: new ObjectId(id) });
    return NextResponse.json(updatedGroup);

  } catch (error) {
    console.error('PUT /api/dataroom/user-groups/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/dataroom/user-groups/[id] - Delete user group
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const group = await db.collection('dataroom_user_groups').findOne({
      _id: new ObjectId(id),
    });

    if (!group) {
      return NextResponse.json({ error: 'User group not found' }, { status: 404 });
    }

    // Soft delete
    await db.collection('dataroom_user_groups').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: user._id.toString(),
        },
      }
    );

    // Remove group permissions
    await db.collection('dataroom_permissions').deleteMany({
      groupId: id,
    });

    await logAudit({
      action: 'GROUP_DELETE',
      resourceType: 'user_group',
      resourceId: id,
      roomId: group.roomId,
      user,
      details: { name: group.name, memberCount: group.members?.length || 0 },
      request,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/dataroom/user-groups/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
