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

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Admins can see all activity
    // Other users can only see activity from projects they're member of
    let query = {};

    // If projectId is specified, filter to that project only
    if (projectId) {
      query.projectId = projectId;
    } else if (user.role !== 'Admin' && user.role !== 'Console admin') {
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

    // Fetch activity logs with pagination
    const total = await db.collection('doc_activity_logs').countDocuments(query);
    const logs = await db.collection('doc_activity_logs')
      .find(query)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Format logs for response
    const formattedLogs = logs.map(log => ({
      _id: log._id?.toString(),
      projectId: log.projectId,
      resourceId: log.resourceId?.toString(),
      action: log.action,
      resourceType: log.resourceType,
      resourceName: log.resourceName,
      targetId: log.targetId,
      targetType: log.targetType,
      targetName: log.targetName,
      user: log.user || {
        userId: log.userId?.toString(),
        username: log.username || 'Unknown',
        email: log.email
      },
      timestamp: log.timestamp,
      details: log.details,
      metadata: log.metadata,
    }));

    return NextResponse.json({ logs: formattedLogs, total });

  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
  }
}
