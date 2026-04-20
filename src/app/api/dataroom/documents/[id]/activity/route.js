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

// GET /api/dataroom/documents/[id]/activity - Get document activity summary
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Check document exists
    const document = await db.collection('dataroom_documents').findOne({ _id: new ObjectId(id) });
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get activity from heartbeat data
    const heartbeats = await db.collection('dataroom_activity_heartbeat')
      .find({ 
        documentId: new ObjectId(id),
        action: 'view'
      })
      .sort({ timestamp: -1 })
      .toArray();

    // Get audit log for downloads
    const downloads = await db.collection('dataroom_audit_log')
      .find({
        resourceType: 'document',
        resourceId: new ObjectId(id),
        action: 'download'
      })
      .toArray();

    // Calculate stats
    const uniqueUsers = new Set(heartbeats.map(h => h.userId)).size;
    const totalViews = heartbeats.length;
    const totalDownloads = downloads.length;

    // Calculate average view duration
    const userSessions = {};
    for (const hb of heartbeats) {
      const userId = hb.userId;
      if (!userSessions[userId]) {
        userSessions[userId] = { start: hb.timestamp, end: hb.timestamp };
      } else {
        if (hb.timestamp > userSessions[userId].end) {
          userSessions[userId].end = hb.timestamp;
        }
        if (hb.timestamp < userSessions[userId].start) {
          userSessions[userId].start = hb.timestamp;
        }
      }
    }

    const durations = Object.values(userSessions).map(session => 
      (new Date(session.end) - new Date(session.start)) / 1000
    );
    const avgViewDuration = durations.length > 0 
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Get recent viewers with details
    const recentViewerIds = [...new Set(heartbeats.slice(0, 50).map(h => h.userId))];
    const recentViewers = [];

    for (const userId of recentViewerIds.slice(0, 10)) {
      const userHeartbeats = heartbeats.filter(h => h.userId === userId);
      const latestHeartbeat = userHeartbeats[0];
      
      // Try to get user from admin_users
      let userData = await db.collection('admin_users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { username: 1, email: 1 } }
      );

      // If not found, try external users
      if (!userData) {
        userData = await db.collection('dataroom_external_users').findOne(
          { _id: new ObjectId(userId) },
          { projection: { name: 1, email: 1 } }
        );
      }

      if (userData && latestHeartbeat) {
        const viewDuration = userSessions[userId] 
          ? (new Date(userSessions[userId].end) - new Date(userSessions[userId].start)) / 1000
          : 0;

        recentViewers.push({
          userName: userData.username || userData.name || userData.email,
          userEmail: userData.email,
          lastViewed: latestHeartbeat.timestamp,
          viewDuration: Math.round(viewDuration),
          device: latestHeartbeat.device,
          location: latestHeartbeat.location,
        });
      }
    }

    // Get top locations
    const locationMap = {};
    for (const hb of heartbeats) {
      if (hb.location && hb.location.city && hb.location.country) {
        const key = `${hb.location.city}, ${hb.location.country}`;
        locationMap[key] = (locationMap[key] || 0) + 1;
      }
    }

    const topLocations = Object.entries(locationMap)
      .map(([location, count]) => {
        const [city, country] = location.split(', ');
        return { city, country, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      totalViews,
      totalDownloads,
      uniqueUsers,
      avgViewDuration,
      recentViewers,
      topLocations,
    });

  } catch (error) {
    console.error('GET /api/dataroom/documents/[id]/activity error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
