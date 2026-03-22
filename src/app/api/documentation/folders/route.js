import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// GET - Fetch folders for a project
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
    const parentId = searchParams.get('parentId') || null;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Check project access
    const project = await db.collection('projects').findOne({ 
      _id: projectId === 'general' ? 'general' : new ObjectId(projectId) 
    });

    if (project && project._id !== 'general') {
      const isMember = project.members?.some(m => m.user === user.username);
      const isSuperManager = project.superManager === user.username;
      const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
      
      if (!isMember && !isSuperManager && !isAdmin) {
        return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 });
      }
    }

    const foldersCollection = db.collection('doc_folders');
    
    const query = { 
      projectId,
      parentId: parentId ? new ObjectId(parentId) : null
    };

    const folders = await foldersCollection.find(query).sort({ name: 1 }).toArray();
    
    return NextResponse.json(folders);
  } catch (error) {
    console.error('Error fetching folders:', error);
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}

// POST - Create a new folder
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

    const { name, projectId, parentId, description } = await req.json();

    if (!name || !projectId) {
      return NextResponse.json({ error: 'Folder name and project ID are required' }, { status: 400 });
    }

    // Check project access and permissions
    if (projectId !== 'general') {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
      
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const isMember = project.members?.some(m => m.user === user.username);
      const isSuperManager = project.superManager === user.username;
      const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
      
      if (!isMember && !isSuperManager && !isAdmin) {
        return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 });
      }
    }

    // Build folder path
    let path = '/';
    if (parentId) {
      const parentFolder = await db.collection('doc_folders').findOne({ _id: new ObjectId(parentId) });
      if (parentFolder) {
        path = `${parentFolder.path}${parentFolder.name}/`;
      }
    }

    const newFolder = {
      name: name.trim(),
      projectId,
      parentId: parentId ? new ObjectId(parentId) : null,
      path,
      description: description || '',
      createdBy: {
        userId: user._id,
        username: user.username,
        email: user.email
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('doc_folders').insertOne(newFolder);

    // Log activity
    await db.collection('doc_activity_logs').insertOne({
      projectId,
      action: 'folder_created',
      targetType: 'folder',
      targetId: result.insertedId,
      targetName: name,
      user: {
        userId: user._id,
        username: user.username,
        email: user.email
      },
      details: { parentId, path },
      timestamp: new Date()
    });

    return NextResponse.json({ _id: result.insertedId, ...newFolder }, { status: 201 });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}
