import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
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

// GET /api/dataroom/rooms/[id]/users - Get all users with access to a room
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Check room exists
    const room = await db.collection('dataroom_rooms').findOne({ _id: new ObjectId(id) });
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Get all permissions for this room
    const permissions = await db.collection('dataroom_permissions')
      .find({
        resourceType: 'room',
        resourceId: new ObjectId(id),
      })
      .toArray();

    // Aggregate user information
    const usersMap = new Map();

    // Add room owner
    const owner = await db.collection('admin_users').findOne(
      { _id: new ObjectId(room.ownerId) },
      { projection: { _id: 1, username: 1, email: 1, role: 1, department: 1 } }
    );
    
    if (owner) {
      usersMap.set(owner._id.toString(), {
        userId: owner._id.toString(),
        userName: owner.username,
        userEmail: owner.email,
        isExternal: false,
        orgRole: owner.role,
        department: owner.department,
        permissions: ['admin', 'write', 'read', 'download', 'print', 'share'],
        isOwner: true,
        lastActivity: null,
        location: null,
      });
    }

    // Add users with permissions
    for (const perm of permissions) {
      if (perm.granteeType === 'user') {
        let userData;
        let isExternal = false;

        // Try internal users first
        userData = await db.collection('admin_users').findOne(
          { _id: new ObjectId(perm.granteeId) },
          { projection: { _id: 1, username: 1, email: 1, role: 1, department: 1 } }
        );

        // Try external users if not found
        if (!userData) {
          userData = await db.collection('dataroom_external_users').findOne(
            { _id: new ObjectId(perm.granteeId) },
            { projection: { _id: 1, name: 1, email: 1, company: 1, designation: 1 } }
          );
          isExternal = true;
        }

        if (userData) {
          const userId = userData._id.toString();
          
          if (!usersMap.has(userId)) {
            usersMap.set(userId, {
              userId,
              userName: isExternal ? userData.name : userData.username,
              userEmail: userData.email,
              isExternal,
              orgRole: isExternal ? userData.designation : userData.role,
              department: isExternal ? userData.company : userData.department,
              permissions: perm.permissions || [],
              isOwner: false,
              lastActivity: null,
              location: null,
            });
          } else {
            // Merge permissions
            const existing = usersMap.get(userId);
            existing.permissions = [...new Set([...existing.permissions, ...perm.permissions])];
          }
        }
      }
    }

    // Enrich with recent activity data
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentActivity = await db.collection('dataroom_activity_heartbeat')
      .find({
        roomId: new ObjectId(id),
        timestamp: { $gte: twoHoursAgo },
      })
      .sort({ timestamp: -1 })
      .toArray();

    // Add last activity and location info
    const activityByUser = {};
    for (const activity of recentActivity) {
      const uid = activity.userId;
      if (!activityByUser[uid]) {
        activityByUser[uid] = {
          lastActivity: activity.timestamp,
          location: activity.location,
        };
      }
    }

    // Apply activity data to users
    for (const [userId, activityData] of Object.entries(activityByUser)) {
      if (usersMap.has(userId)) {
        const userData = usersMap.get(userId);
        userData.lastActivity = activityData.lastActivity;
        userData.location = activityData.location;
      }
    }

    const users = Array.from(usersMap.values()).sort((a, b) => {
      // Owners first
      if (a.isOwner && !b.isOwner) return -1;
      if (!a.isOwner && b.isOwner) return 1;
      
      // Then by name
      return a.userName.localeCompare(b.userName);
    });

    return NextResponse.json({
      users,
      totalUsers: users.length,
      roomName: room.name,
    });

  } catch (error) {
    console.error('GET /api/dataroom/rooms/[id]/users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
