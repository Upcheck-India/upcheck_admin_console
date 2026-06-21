import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { canAccessProject } from '../../../../lib/projectPermissions';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch user teams for permission evaluation
    const userIdStr = user._id?.toString();
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
          { lead: userIdStr },
          { members: user._id },
          { lead: user._id }
        ]
      })
      .toArray();

    // 2. Fetch projects and filter for accessibility
    const projects = await db.collection('projects').find().toArray();
    const accessibleProjectIds = new Set();
    const projectMap = new Map();

    projects.forEach(project => {
      const isAccessible = canAccessProject(user, project, userTeams);
      if (isAccessible) {
        const idStr = project._id.toString();
        accessibleProjectIds.add(idStr);
        projectMap.set(idStr, project.name);
      }
    });

    // 3. Fetch project level activities from doc_activity_logs
    const projectLogs = await db.collection('doc_activity_logs')
      .find({
        projectId: { $exists: true, $ne: null }
      })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    // 4. Fetch task level activities using aggregation on project_tasks activity field
    const taskActivities = await db.collection('project_tasks').aggregate([
      { $match: { activity: { $exists: true, $not: { $size: 0 } } } },
      { $unwind: "$activity" },
      { $sort: { "activity.createdAt": -1 } },
      { $limit: 100 },
      {
        $project: {
          _id: "$activity._id",
          action: {
            $cond: {
              if: { $eq: ["$activity.type", "status_change"] },
              then: "MOVE_TASK",
              else: {
                $cond: {
                  if: { $eq: ["$activity.type", "comment"] },
                  then: "COMMENT_TASK",
                  else: "UPDATE_TASK"
                }
              }
            }
          },
          projectId: "$projectId",
          taskId: "$_id",
          taskTitle: "$title",
          userId: "$activity.userId",
          userName: "$activity.userName",
          timestamp: "$activity.createdAt",
          details: {
            changes: "$activity.changes",
            comment: "$activity.comment",
            content: "$activity.content"
          }
        }
      }
    ]).toArray();

    // 5. Combine and filter logs
    const combined = [];

    // Process project logs
    projectLogs.forEach(log => {
      const pid = log.projectId?.toString();
      if (accessibleProjectIds.has(pid)) {
        combined.push({
          id: log._id.toString(),
          type: 'project',
          action: log.action,
          projectId: pid,
          projectName: projectMap.get(pid) || log.projectName || 'Unknown Project',
          userId: log.userId?.toString(),
          userName: log.userName || 'Unknown User',
          timestamp: log.timestamp || log.createdAt,
          details: log.details || {},
          targetUser: log.targetUser,
          role: log.role
        });
      }
    });

    // Process task activities
    taskActivities.forEach(act => {
      const pid = act.projectId?.toString();
      if (accessibleProjectIds.has(pid)) {
        combined.push({
          id: act._id.toString(),
          type: 'task',
          action: act.action,
          projectId: pid,
          projectName: projectMap.get(pid) || 'Unknown Project',
          taskId: act.taskId?.toString(),
          taskTitle: act.taskTitle || 'Untitled Task',
          userId: act.userId?.toString(),
          userName: act.userName || 'Unknown User',
          timestamp: act.timestamp,
          details: act.details || {}
        });
      }
    });

    // 6. Sort merged logs by timestamp descending
    combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit to top 100
    const finalLogs = combined.slice(0, 100);

    return NextResponse.json({
      logs: finalLogs,
      projects: Array.from(projectMap.entries()).map(([id, name]) => ({ id, name }))
    });

  } catch (error) {
    console.error('Failed to fetch project activity logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
