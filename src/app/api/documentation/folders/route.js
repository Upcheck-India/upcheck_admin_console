import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { canAccessProject, canCreateInProject, canAccessGeneralSpace, getGeneralSpacePermissionLevel } from '../../../../lib/projectPermissions';

// Helper to fetch user's teams for permission checking
async function getUserTeams(db, user) {
  const userIdStr = user._id?.toString();
  if (!userIdStr) return [];
  return await db.collection('teams')
    .find({
      $or: [
        { members: userIdStr },
        { lead: userIdStr },
        { members: user._id },
        { lead: user._id },
      ],
    })
    .toArray();
}

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
    const parentId = searchParams.get('parentId');
    const getAll = searchParams.get('all') === 'true';

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Check project access using permission system
    if (projectId === 'general') {
      // For General space, fetch permissions from database
      const generalPerms = await db.collection('general_space_permissions').findOne({ _id: 'general' });
      const permSettings = generalPerms?.permissionSettings;

      if (!canAccessGeneralSpace(user, permSettings)) {
        return NextResponse.json({ error: 'Access denied to General space' }, { status: 403 });
      }
    } else {
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(projectId)
      });

      // Fetch user teams for team-based permission checking
      const userTeams = await getUserTeams(db, user);

      if (project && !canAccessProject(user, project, userTeams)) {
        return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 });
      }
    }

    const foldersCollection = db.collection('doc_folders');

    // Determine query based on parameters
    let query;
    if (getAll) {
      // Return all folders for tree building
      query = { projectId };
    } else if (parentId !== null && parentId !== undefined && parentId !== '') {
      // Return folders with specific parent
      query = { projectId, parentId: new ObjectId(parentId) };
    } else {
      // Return root-level folders (no parent)
      query = { projectId, parentId: null };
    }

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
    if (projectId === 'general') {
      // For General space, fetch permissions from database
      const generalPerms = await db.collection('general_space_permissions').findOne({ _id: 'general' });
      const permSettings = generalPerms?.permissionSettings;

      // Check if user can access General space
      if (!canAccessGeneralSpace(user, permSettings)) {
        return NextResponse.json({ error: 'Access denied to General space' }, { status: 403 });
      }

      // Check if user can create folders in General space
      const perms = getGeneralSpacePermissionLevel(user, permSettings);
      if (!perms || perms.writeScope === 'none') {
        return NextResponse.json({ error: 'Access denied: You do not have permission to create folders in General space' }, { status: 403 });
      }
    } else {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      // Fetch user teams for team-based permission checking
      const userTeams = await getUserTeams(db, user);

      // Check if user can access the project
      if (!canAccessProject(user, project, userTeams)) {
        return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 });
      }

      // Check if user can create folders in this project
      if (!canCreateInProject(user, project, userTeams)) {
        return NextResponse.json({ error: 'Access denied: You do not have permission to create folders' }, { status: 403 });
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
