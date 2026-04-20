import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
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

function isAdminLike(user) {
  return user && (user.role === 'Admin' || user.role === 'Console admin');
}

// GET /api/dataroom/analytics - Get analytics for room or document
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const documentId = searchParams.get('documentId');
    const type = searchParams.get('type') || 'summary'; // summary, engagement, users

    const client = await clientPromise;
    const db = client.db('resources');

    if (type === 'summary') {
      // Overall room or document summary
      const filter = {};
      if (documentId && ObjectId.isValid(documentId)) {
        filter.documentId = new ObjectId(documentId);
      } else if (roomId && ObjectId.isValid(roomId)) {
        // Get all documents in room
        const docs = await db.collection('dataroom_documents')
          .find({ roomId: new ObjectId(roomId) })
          .project({ _id: 1 })
          .toArray();
        filter.documentId = { $in: docs.map(d => d._id) };
      }

      const analytics = await db.collection('dataroom_analytics')
        .find(filter)
        .toArray();

      const summary = {
        totalViews: analytics.reduce((sum, a) => sum + (a.viewCount || 0), 0),
        totalDownloads: analytics.reduce((sum, a) => sum + (a.downloadCount || 0), 0),
        uniqueViewers: new Set(analytics.flatMap(a => a.views?.map(v => v.userId) || [])).size,
        documentsViewed: new Set(analytics.map(a => a.documentId?.toString())).size,
        lastActivity: analytics.reduce((latest, a) => {
          const lastView = a.views?.[a.views.length - 1]?.timestamp;
          return lastView && (!latest || new Date(lastView) > new Date(latest)) ? lastView : latest;
        }, null),
      };

      return NextResponse.json(summary);
    }

    if (type === 'engagement') {
      // Document engagement details
      if (!documentId || !ObjectId.isValid(documentId)) {
        return NextResponse.json({ error: 'documentId required for engagement analytics' }, { status: 400 });
      }

      const analytics = await db.collection('dataroom_analytics')
        .find({ documentId: new ObjectId(documentId) })
        .toArray();

      const allViews = analytics.flatMap(a => a.views || []);
      const allDownloads = analytics.flatMap(a => a.downloads || []);

      // Calculate time spent (rough estimate from view timestamps)
      const timeSpent = {};
      allViews.forEach(view => {
        const userId = view.userId;
        if (!timeSpent[userId]) timeSpent[userId] = 0;
        // Estimate: each view = 2 minutes (would need actual tracking for accuracy)
        timeSpent[userId] += 120000; // 2 min in ms
      });

      return NextResponse.json({
        totalViews: allViews.length,
        totalDownloads: allDownloads.length,
        uniqueViewers: new Set(allViews.map(v => v.userId)).size,
        viewsByUser: allViews.reduce((acc, v) => {
          acc[v.userEmail] = (acc[v.userEmail] || 0) + 1;
          return acc;
        }, {}),
        downloadsByUser: allDownloads.reduce((acc, d) => {
          acc[d.userEmail] = (acc[d.userEmail] || 0) + 1;
          return acc;
        }, {}),
        estimatedTimeSpent: timeSpent,
        viewTimeline: allViews.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
      });
    }

    if (type === 'users') {
      // User activity across room
      if (!roomId || !ObjectId.isValid(roomId)) {
        return NextResponse.json({ error: 'roomId required for user analytics' }, { status: 400 });
      }

      const docs = await db.collection('dataroom_documents')
        .find({ roomId: new ObjectId(roomId) })
        .project({ _id: 1, name: 1 })
        .toArray();

      const docIds = docs.map(d => d._id);
      const analytics = await db.collection('dataroom_analytics')
        .find({ documentId: { $in: docIds } })
        .toArray();

      const userActivity = {};
      
      analytics.forEach(a => {
        (a.views || []).forEach(view => {
          if (!userActivity[view.userId]) {
            userActivity[view.userId] = {
              userId: view.userId,
              userEmail: view.userEmail,
              views: 0,
              downloads: 0,
              documentsViewed: new Set(),
              lastActivity: null,
            };
          }
          userActivity[view.userId].views++;
          userActivity[view.userId].documentsViewed.add(a.documentId.toString());
          const ts = new Date(view.timestamp);
          if (!userActivity[view.userId].lastActivity || ts > userActivity[view.userId].lastActivity) {
            userActivity[view.userId].lastActivity = ts;
          }
        });

        (a.downloads || []).forEach(download => {
          if (userActivity[download.userId]) {
            userActivity[download.userId].downloads++;
          }
        });
      });

      // Convert Set to count
      Object.values(userActivity).forEach(u => {
        u.documentsViewed = u.documentsViewed.size;
      });

      return NextResponse.json({
        totalUsers: Object.keys(userActivity).length,
        users: Object.values(userActivity).sort((a, b) => b.views - a.views),
      });
    }

    return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 });

  } catch (error) {
    console.error('GET /api/dataroom/analytics error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
