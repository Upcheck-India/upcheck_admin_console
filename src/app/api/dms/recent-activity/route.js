import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

export async function GET(request) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');

    // Get recent activity from both systems
    const [dataroomActivity, documentationActivity] = await Promise.all([
      // Recent dataroom audit logs
      db.collection('dataroom_audit_log')
        .find({})
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray(),
      
      // Recent documentation activity (if you have an activity log)
      // For now, we'll get recently updated resources
      db.collection('resources')
        .find({})
        .sort({ updatedAt: -1 })
        .limit(10)
        .toArray()
    ]);

    // Combine and format activities
    const activities = [];

    // Process dataroom activities
    dataroomActivity.forEach(log => {
      let action = 'Activity';
      const moduleName = 'Data Room';

      // Safely get action string, default to empty if null/undefined
      const actionStr = log.action || '';

      // Map action types to readable strings
      if (actionStr.includes('UPLOAD')) action = 'Document uploaded';
      else if (actionStr.includes('DOWNLOAD')) action = 'Document downloaded';
      else if (actionStr.includes('VIEW')) action = 'Document viewed';
      else if (actionStr.includes('DELETE')) action = 'Document deleted';
      else if (actionStr.includes('PERMISSION')) action = 'Permission granted';
      else if (actionStr.includes('CREATE')) action = 'Item created';
      else if (actionStr.includes('UPDATE')) action = 'Item updated';
      else if (actionStr) action = actionStr.toLowerCase().replace('_', ' ');

      activities.push({
        action,
        module: moduleName,
        time: log.timestamp,
        user: log.user?.email || log.user?.username || 'System',
        _timestamp: new Date(log.timestamp).getTime()
      });
    });

    // Process documentation activities
    documentationActivity.forEach(resource => {
      activities.push({
        action: resource.createdAt === resource.updatedAt ? 'Document created' : 'Document updated',
        module: 'Documentation',
        time: resource.updatedAt || resource.createdAt,
        user: resource.uploadedBy?.username || 'User',
        _timestamp: new Date(resource.updatedAt || resource.createdAt).getTime()
      });
    });

    // Sort by timestamp (most recent first)
    activities.sort((a, b) => b._timestamp - a._timestamp);

    // Take top 20 and format time
    const recentActivities = activities.slice(0, 20).map(activity => {
      const timeAgo = getTimeAgo(activity.time);
      return {
        action: activity.action,
        module: activity.module,
        time: timeAgo,
        user: activity.user
      };
    });

    return NextResponse.json({ activities: recentActivities });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent activity' },
      { status: 500 }
    );
  }
}

function getTimeAgo(date) {
  const now = new Date();
  const then = new Date(date);
  const diff = Math.floor((now - then) / 1000); // seconds

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return then.toLocaleDateString();
}
