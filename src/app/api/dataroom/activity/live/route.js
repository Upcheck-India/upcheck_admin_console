import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

async function getUserFromToken(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      // Check external user token
      const externalToken = request.cookies.get('external_user_token')?.value;
      if (!externalToken) return null;
      
      const client = await clientPromise;
      const db = client.db('resources');
      const externalUser = await db.collection('dataroom_external_users').findOne(
        { sessionToken: externalToken },
        { projection: { _id: 1, email: 1, name: 1, role: 1 } }
      );
      
      if (externalUser) {
        return {
          ...externalUser,
          username: externalUser.name,
          isExternal: true,
        };
      }
      return null;
    }
    
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, username: 1, role: 1 } }
    );
    return user ? { ...user, isExternal: false } : null;
  } catch {
    return null;
  }
}

// GET /api/dataroom/activity/live - Get live user activity (who's viewing what)
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    const client = await clientPromise;
    const db = client.db('resources');

    // Get recent heartbeats (last 2 minutes = active viewers with 10s heartbeat)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    const query = {
      timestamp: { $gte: twoMinutesAgo },
    };

    if (roomId && ObjectId.isValid(roomId)) {
      query.roomId = new ObjectId(roomId);
    }

    const recentHeartbeats = await db.collection('dataroom_activity_heartbeat')
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();

    // Group by user
    const activeUsers = {};

    for (const hb of recentHeartbeats) {
      const userId = hb.userId;
      
      if (!userId) continue;

      if (!activeUsers[userId]) {
        activeUsers[userId] = {
          userId,
          userName: hb.userName,
          userEmail: hb.userEmail,
          isExternal: hb.isExternal || false,
          device: hb.device || 'Unknown',
          browser: hb.browser || 'Unknown',
          os: hb.os || 'Unknown',
          location: {
            city: hb.location?.city || 'Unknown',
            country: hb.location?.country || 'Unknown',
          },
          ipAddress: hb.ipAddress || 'Unknown',
          viewing: new Map(),
          firstSeen: hb.timestamp,
          lastActivity: hb.timestamp,
        };
      }

      // Update last activity time
      if (new Date(hb.timestamp) > new Date(activeUsers[userId].lastActivity)) {
        activeUsers[userId].lastActivity = hb.timestamp;
      }

      // Track earliest seen time
      if (new Date(hb.timestamp) < new Date(activeUsers[userId].firstSeen)) {
        activeUsers[userId].firstSeen = hb.timestamp;
      }

      // Track documents being viewed
      const docId = hb.documentId?.toString();
      if (docId && !activeUsers[userId].viewing.has(docId)) {
        // Fetch document details
        const doc = await db.collection('dataroom_documents').findOne(
          { _id: hb.documentId },
          { projection: { name: 1 } }
        );

        activeUsers[userId].viewing.set(docId, {
          documentId: docId,
          documentName: doc?.name || 'Unknown',
          roomId: hb.roomId?.toString(),
          viewedAt: hb.timestamp,
        });
      }
    }

    // Convert viewing map to array and calculate session duration
    const activity = Object.values(activeUsers).map(user => {
      const sessionDuration = Math.floor((new Date(user.lastActivity) - new Date(user.firstSeen)) / 1000);
      return {
        ...user,
        viewing: Array.from(user.viewing.values()),
        sessionDuration, // in seconds
      };
    }).sort((a, b) => 
      new Date(b.lastActivity) - new Date(a.lastActivity)
    );

    return NextResponse.json({
      activity,
      totalActiveUsers: activity.length,
      asOf: new Date().toISOString(),
    });

  } catch (error) {
    console.error('GET /api/dataroom/activity/live error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/dataroom/activity/live - Record user activity heartbeat
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { documentId, roomId, action = 'viewing' } = body;

    if (!documentId || !ObjectId.isValid(documentId)) {
      return NextResponse.json({ error: 'Valid documentId is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Record activity in a lightweight collection
    await db.collection('dataroom_activity_heartbeat').insertOne({
      userId: user._id.toString(),
      userEmail: user.email,
      userName: user.username || user.name,
      isExternal: user.isExternal || false,
      documentId: new ObjectId(documentId),
      roomId: roomId ? new ObjectId(roomId) : null,
      action,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Auto-expire after 10 minutes
    });

    // Create TTL index if not exists (run once)
    try {
      await db.collection('dataroom_activity_heartbeat').createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 }
      );
    } catch (e) {
      // Index might already exist
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('POST /api/dataroom/activity/live error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
