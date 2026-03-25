// src/app/api/admin/cleanup-activity-logs/route.js
// Scheduled endpoint for cleaning up old activity logs
// Call this endpoint periodically (e.g., daily via cron job)

import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { cookies } from 'next/headers';

const LOG_RETENTION = {
  GUARANTEED_DAYS: 14,           // Keep all logs for at least 14 days
  MAX_LOGS_TOTAL: 10000,         // Max logs in entire collection
  MAX_LOGS_PER_PROJECT: 1000,    // Max logs per project
};

/**
 * Cleanup old activity logs to prevent database bloat
 */
async function cleanupOldLogs(db) {
  const logsCollection = db.collection('doc_activity_logs');
  const cutoffDate = new Date(Date.now() - (LOG_RETENTION.GUARANTEED_DAYS * 24 * 60 * 60 * 1000));

  const stats = {
    deletedPerProject: 0,
    deletedGlobal: 0,
    deletedVeryOld: 0,
    errors: []
  };

  try {
    // Step 1: Clean up per-project logs (beyond guaranteed period)
    const projects = await db.collection('projects').find({}).project({ _id: 1 }).toArray();
    const projectIds = ['general', ...projects.map(p => p._id.toString())];

    for (const projectId of projectIds) {
      try {
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
            const result = await logsCollection.deleteMany({
              _id: { $in: logsToRemove.map(l => l._id) }
            });
            stats.deletedPerProject += result.deletedCount;
          }
        }
      } catch (err) {
        stats.errors.push(`Project ${projectId}: ${err.message}`);
      }
    }

    // Step 2: Clean up global total if exceeded
    const totalLogs = await logsCollection.countDocuments({});
    if (totalLogs > LOG_RETENTION.MAX_LOGS_TOTAL) {
      const logsToDelete = totalLogs - LOG_RETENTION.MAX_LOGS_TOTAL;
      const logsToRemove = await logsCollection.find({})
        .sort({ timestamp: 1 })
        .limit(logsToDelete)
        .project({ _id: 1 })
        .toArray();

      if (logsToRemove.length > 0) {
        const result = await logsCollection.deleteMany({
          _id: { $in: logsToRemove.map(l => l._id) }
        });
        stats.deletedGlobal += result.deletedCount;
      }
    }

    // Step 3: Delete very old logs (beyond 90 days) regardless of limits
    const veryOldCutoff = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000));
    const veryOldResult = await logsCollection.deleteMany({
      timestamp: { $lt: veryOldCutoff }
    });
    stats.deletedVeryOld = veryOldResult.deletedCount;

    return {
      success: true,
      stats,
      message: `Cleaned up ${stats.deletedPerProject + stats.deletedGlobal + stats.deletedVeryOld} old activity logs`
    };
  } catch (error) {
    return {
      success: false,
      stats,
      error: error.message
    };
  }
}

export async function POST(req) {
  try {
    // Check for admin authentication
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    // Only admins can trigger cleanup
    if (user.role !== 'Admin' && user.role !== 'Console admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const result = await cleanupOldLogs(db);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 500 });
    }

  } catch (error) {
    console.error('Error in cleanup endpoint:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Also allow GET for easier cron job integration
export async function GET(req) {
  // For security, GET requires a secret key in query params
  const cleanupSecret = req.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.ACTIVITY_CLEANUP_SECRET;

  if (expectedSecret && cleanupSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return POST(req);
}
