import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// GET - Fetch activity logs for a project
export async function GET(req) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');
    const action = searchParams.get('action'); // Optional filter by action type

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Check project access (skip DB lookup for general project)
    if (projectId && projectId !== 'general') {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
      
      if (project) {
        const isMember = project.members?.some(m => m.user === user.username);
        const isSuperManager = project.superManager === user.username;
        const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
        
        if (!isMember && !isSuperManager && !isAdmin) {
          return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 });
        }
      }
    }

    const query = { projectId };
    if (action) {
      query.action = action;
    }

    const logs = await db.collection('doc_activity_logs')
      .find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('doc_activity_logs').countDocuments(query);

    return NextResponse.json({ logs, total, limit, skip });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
  }
}

// POST - Log an activity (internal use)
export async function POST(req) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, action, targetType, targetId, targetName, details } = await req.json();

    if (!projectId || !action) {
      return NextResponse.json({ error: 'Project ID and action are required' }, { status: 400 });
    }

    const logEntry = {
      projectId,
      action,
      targetType: targetType || 'unknown',
      targetId: targetId ? new ObjectId(targetId) : null,
      targetName: targetName || '',
      user: {
        userId: user._id,
        username: user.username,
        email: user.email
      },
      details: details || {},
      timestamp: new Date()
    };

    const result = await db.collection('doc_activity_logs').insertOne(logEntry);

    return NextResponse.json({ _id: result.insertedId, ...logEntry }, { status: 201 });
  } catch (error) {
    console.error('Error logging activity:', error);
    return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
  }
}
