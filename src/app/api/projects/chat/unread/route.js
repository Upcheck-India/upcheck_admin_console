import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    
    const currentUser = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Find user's teams
    const userIdStr = currentUser._id.toString();
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
        messages: [],
        serverTime: new Date().toISOString()
      });
    }

    const projectIds = projects.map(p => p._id);
    const projectMap = projects.reduce((acc, p) => {
      acc[p._id.toString()] = p.name;
      return acc;
    }, {});

    const query = {
      projectId: { $in: projectIds },
      "sender.userId": { $ne: currentUser._id.toString() },
      deletedFor: { $ne: currentUser._id.toString() }
    };

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        query.createdAt = { $gt: sinceDate };
      }
    } else {
      // Default to messages from the last 10 seconds to avoid spamming past history on first load
      query.createdAt = { $gt: new Date(Date.now() - 10000) };
    }

    const messages = await db.collection('project_messages')
      .find(query)
      .sort({ createdAt: 1 })
      .toArray();

    const serialized = messages.map(m => ({
      id: m._id.toString(),
      body: m.body,
      createdAt: m.createdAt,
      projectId: m.projectId.toString(),
      projectName: projectMap[m.projectId.toString()] || 'Unknown Project',
      senderName: m.sender?.name || m.sender?.username || 'Teammate',
      isDeletedForEveryone: m.isDeletedForEveryone === true
    }));

    return NextResponse.json({
      messages: serialized,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    console.error('Project unread messages error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
