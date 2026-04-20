// src/app/api/documentation/activity/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

// Configuration for log retention
const LOG_RETENTION = {
  GUARANTEED_DAYS: 14,           // Keep all logs for at least 14 days
  MAX_LOGS_TOTAL: 10000,         // Max logs in entire collection
  MAX_LOGS_PER_PROJECT: 1000,    // Max logs per project
  CLEANUP_PROBABILITY: 0.15,     // 15% chance to run cleanup on each fetch
};

/**
 * Cleanup old activity logs to prevent database bloat
 * Strategy:
 * 1. Always keep logs from the last GUARANTEED_DAYS (14 days)
 * 2. For logs older than GUARANTEED_DAYS, keep only MAX_LOGS_PER_PROJECT per project
 * 3. Also enforce a global max of MAX_LOGS_TOTAL
 */
async function cleanupOldLogs(db) {
  const logsCollection = db.collection('doc_activity_logs');
  const cutoffDate = new Date(Date.now() - (LOG_RETENTION.GUARANTEED_DAYS * 24 * 60 * 60 * 1000));

  try {
    // Step 1: Clean up per-project logs (beyond guaranteed period)
    const projects = await db.collection('projects').find({}).project({ _id: 1 }).toArray();
    const projectIds = ['general', ...projects.map(p => p._id.toString())];

    for (const projectId of projectIds) {
      // Count logs older than guaranteed period for this project
      const oldLogsCount = await logsCollection.countDocuments({
        projectId,
        timestamp: { $lt: cutoffDate }
      });

      if (oldLogsCount > LOG_RETENTION.MAX_LOGS_PER_PROJECT) {
        // Delete the oldest logs, keeping only MAX_LOGS_PER_PROJECT of the old ones
        const logsToDelete = oldLogsCount - LOG_RETENTION.MAX_LOGS_PER_PROJECT;
        const logsToRemove = await logsCollection.find({
          projectId,
          timestamp: { $lt: cutoffDate }
        })
          .sort({ timestamp: 1 })  // Oldest first
          .limit(logsToDelete)
          .project({ _id: 1 })
          .toArray();

        if (logsToRemove.length > 0) {
          await logsCollection.deleteMany({
            _id: { $in: logsToRemove.map(l => l._id) }
          });
          console.log(`[Activity Cleanup] Deleted ${logsToRemove.length} old logs for project: ${projectId}`);
        }
      }
    }

    // Step 2: Clean up global total if exceeded (prioritize keeping recent logs)
    const totalLogs = await logsCollection.countDocuments({});
    if (totalLogs > LOG_RETENTION.MAX_LOGS_TOTAL) {
      const logsToDelete = totalLogs - LOG_RETENTION.MAX_LOGS_TOTAL;
      const logsToRemove = await logsCollection.find({})
        .sort({ timestamp: 1 })  // Oldest first
        .limit(logsToDelete)
        .project({ _id: 1 })
        .toArray();

      if (logsToRemove.length > 0) {
        await logsCollection.deleteMany({
          _id: { $in: logsToRemove.map(l => l._id) }
        });
        console.log(`[Activity Cleanup] Deleted ${logsToRemove.length} old logs to meet global limit`);
      }
    }

    // Step 3: Delete very old logs (beyond 90 days) regardless of limits
    const veryOldCutoff = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000));
    const veryOldResult = await logsCollection.deleteMany({
      timestamp: { $lt: veryOldCutoff }
    });

    if (veryOldResult.deletedCount > 0) {
      console.log(`[Activity Cleanup] Deleted ${veryOldResult.deletedCount} logs older than 90 days`);
    }

    return { success: true };
  } catch (error) {
    console.error('[Activity Cleanup] Error:', error);
    return { success: false, error: error.message };
  }
}

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
    const skipCleanup = searchParams.get('cleanup') === 'false';

    // Run cleanup probabilistically to prevent log bloat (15% chance on each fetch)
    if (!skipCleanup && Math.random() < LOG_RETENTION.CLEANUP_PROBABILITY) {
      // Run cleanup in background without blocking the response
      cleanupOldLogs(db).catch(err => console.error('[Activity Cleanup] Background error:', err));
    }

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

/**
 * POST /api/documentation/activity/cleanup
 * Manually trigger cleanup of old activity logs
 */
export async function POST(req) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    // Only admins can trigger manual cleanup
    if (user.role !== 'Admin' && user.role !== 'Console admin') {
      return NextResponse.json({ error: 'Forbidden: Only admins can trigger cleanup' }, { status: 403 });
    }

    const result = await cleanupOldLogs(db);

    if (result.success) {
      return NextResponse.json({ message: 'Activity logs cleaned up successfully' });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

  } catch (error) {
    console.error('Error triggering cleanup:', error);
    return NextResponse.json({ error: 'Failed to trigger cleanup' }, { status: 500 });
  }
}
