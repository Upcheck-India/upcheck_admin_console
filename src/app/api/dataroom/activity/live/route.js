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

    // Get recent view events (last 5 minutes = active viewers)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const query = {
      action: 'DOCUMENT_VIEW',
      timestamp: { $gte: fiveMinutesAgo },
    };

    if (roomId && ObjectId.isValid(roomId)) {
      query.roomId = new ObjectId(roomId);
    }

    const recentViews = await db.collection('dataroom_audit_log')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    // Group by user and document
    const activeUsers = {};
    const viewingMap = new Map();

    for (const view of recentViews) {
      const userId = view.user?.id || view.user?.email;
      const docId = view.resourceId?.toString();
      
      if (!userId || !docId) continue;

      const key = `${userId}_${docId}`;
      
      if (!viewingMap.has(key)) {
        viewingMap.set(key, true);
        
        if (!activeUsers[userId]) {
          activeUsers[userId] = {
            userId,
            userName: view.user?.username || view.user?.name || view.user?.email,
            userEmail: view.user?.email,
            isExternal: view.details?.isExternal || false,
            viewing: [],
            lastActivity: view.timestamp,
          };
        }

        activeUsers[userId].viewing.push({
          documentId: docId,
          documentName: view.details?.name || 'Unknown',
          roomId: view.roomId?.toString(),
          viewedAt: view.timestamp,
        });

        if (new Date(view.timestamp) > new Date(activeUsers[userId].lastActivity)) {
          activeUsers[userId].lastActivity = view.timestamp;
        }
      }
    }

    const activity = Object.values(activeUsers).sort((a, b) => 
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
