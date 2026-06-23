import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserPermissionLevel } from '../../../../../lib/projectPermissions';

// GET - Retrieve users currently typing (excluding the current user)
export async function GET(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Validate project permissions
    const userIdStr = user._id?.toString();
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
          { lead: userIdStr },
          { members: user._id },
          { lead: user._id },
        ],
      })
      .toArray();

    const perms = getUserPermissionLevel(user, project, userTeams);
    if (!perms) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Typing threshold is 6 seconds
    const sixSecondsAgo = new Date(Date.now() - 6000);
    const typing = await db.collection('project_chat_typing')
      .find({
        projectId: new ObjectId(id),
        username: { $ne: user.username },
        updatedAt: { $gte: sixSecondsAgo }
      })
      .toArray();

    const typingUsers = typing.map(t => ({
      username: t.username,
      name: t.name,
      role: t.role
    }));

    return NextResponse.json({ typingUsers });

  } catch (error) {
    console.error('Failed to get typing users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST - Update typing status
export async function POST(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Validate project permissions
    const userIdStr = user._id?.toString();
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { members: userIdStr },
          { lead: userIdStr },
          { members: user._id },
          { lead: user._id },
        ],
      })
      .toArray();

    const perms = getUserPermissionLevel(user, project, userTeams);
    if (!perms) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { isTyping } = body;

    const query = {
      projectId: new ObjectId(id),
      username: user.username
    };

    if (isTyping) {
      await db.collection('project_chat_typing').updateOne(
        query,
        {
          $set: {
            name: user.name || user.username,
            role: user.role || 'Member',
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
    } else {
      await db.collection('project_chat_typing').deleteOne(query);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to update typing status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
