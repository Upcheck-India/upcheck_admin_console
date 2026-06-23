import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    
    const currentUser = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userIdStr = currentUser._id.toString();

    // Find user's teams
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
          { lead: userIdStr },
          { members: currentUser._id },
          { lead: currentUser._id },
        ],
      })
      .toArray();

    const teamIdsStr = userTeams.map(t => t._id.toString());
    const teamObjectIds = userTeams.map(t => t._id);

    // Find all projects user has access to
    const projects = await db.collection('projects').find({
      $or: [
        { superManager: currentUser.username },
        { "members.user": currentUser.username },
        { "permissionSettings.allowedTeams": { $in: teamIdsStr } },
        { "permissionSettings.allowedTeams": { $in: teamObjectIds } }
      ]
    }).project({ _id: 1, name: 1 }).toArray();

    if (projects.length === 0) {
      return NextResponse.json({
        unreadCounts: {},
        totalUnreadCount: 0
      });
    }

    const projectIds = projects.map(p => p._id);

    // Find all read statuses for this user
    const readStatuses = await db.collection('project_chat_read_status')
      .find({ userId: userIdStr, projectId: { $in: projectIds } })
      .toArray();

    const readStatusMap = readStatuses.reduce((acc, rs) => {
      acc[rs.projectId.toString()] = rs.lastReadAt;
      return acc;
    }, {});

    const unreadCounts = {};
    let totalUnreadCount = 0;

    // Calculate unread count for each project
    for (const project of projects) {
      const projIdStr = project._id.toString();
      const lastRead = readStatusMap[projIdStr] || new Date(0); // If never read, default to epoch

      const count = await db.collection('project_messages').countDocuments({
        projectId: project._id,
        createdAt: { $gt: lastRead },
        "sender.userId": { $ne: userIdStr },
        deletedFor: { $ne: userIdStr }
      });

      unreadCounts[projIdStr] = count;
      totalUnreadCount += count;
    }

    return NextResponse.json({
      unreadCounts,
      totalUnreadCount
    });
  } catch (err) {
    console.error('Project unread counts error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
