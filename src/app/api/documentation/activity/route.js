// src/app/api/documentation/activity/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

/**
 * GET /api/documentation/activity
 * Get all activity logs across projects (for authorized users)
 */
export async function GET(req) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admins can see all activity
    // Other users can only see activity from projects they're member of
    let query = {};

    if (user.role !== 'Admin' && user.role !== 'Console admin') {
      // Get all project IDs the user is a member of
      const projects = await db.collection('projects')
        .find({
          $or: [
            { superManager: user.username },
            { 'members.user': user.username }
          ]
        })
        .toArray();

      const projectIds = projects.map(p => p._id.toString());

      // Also include general project logs
      query = {
        $or: [
          { projectId: { $in: [...projectIds, 'general'] } },
          { userId: user._id },
          { 'user.username': user.username }
        ]
      };
    }

    // Fetch activity logs
    const logs = await db.collection('doc_activity_logs')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(1000)
      .toArray();

    // Format logs for response
    const formattedLogs = logs.map(log => ({
      _id: log._id?.toString(),
      projectId: log.projectId,
      resourceId: log.resourceId?.toString(),
      action: log.action,
      resourceType: log.resourceType,
      resourceName: log.resourceName,
      userId: log.userId?.toString(),
      username: log.username,
      timestamp: log.timestamp,
      details: log.details,
      metadata: log.metadata,
    }));

    return NextResponse.json(formattedLogs);

  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
  }
}
