import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// GET - Fetch a single folder
export async function GET(req, { params }) {
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

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
    }

    const folder = await db.collection('doc_folders').findOne({ _id: new ObjectId(id) });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    return NextResponse.json(folder);
  } catch (error) {
    console.error('Error fetching folder:', error);
    return NextResponse.json({ error: 'Failed to fetch folder' }, { status: 500 });
  }
}

// PUT - Update a folder
export async function PUT(req, { params }) {
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

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
    }

    const folder = await db.collection('doc_folders').findOne({ _id: new ObjectId(id) });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Check project access
    if (folder.projectId !== 'general') {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(folder.projectId) });
      
      if (project) {
        const isMember = project.members?.some(m => m.user === user.username);
        const isSuperManager = project.superManager === user.username;
        const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
        
        if (!isMember && !isSuperManager && !isAdmin) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    const { name, description } = await req.json();

    const updateFields = { updatedAt: new Date() };
    if (name !== undefined) updateFields.name = name.trim();
    if (description !== undefined) updateFields.description = description.trim();

    await db.collection('doc_folders').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    // Log activity
    await db.collection('doc_activity_logs').insertOne({
      projectId: folder.projectId,
      action: 'folder_renamed',
      targetType: 'folder',
      targetId: new ObjectId(id),
      targetName: name || folder.name,
      user: {
        userId: user._id,
        username: user.username,
        email: user.email
      },
      details: { oldName: folder.name, newName: name },
      timestamp: new Date()
    });

    const updatedFolder = await db.collection('doc_folders').findOne({ _id: new ObjectId(id) });
    return NextResponse.json(updatedFolder);
  } catch (error) {
    console.error('Error updating folder:', error);
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
  }
}

// DELETE - Delete a folder
export async function DELETE(req, { params }) {
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

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
    }

    const folder = await db.collection('doc_folders').findOne({ _id: new ObjectId(id) });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Check project access
    if (folder.projectId !== 'general') {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(folder.projectId) });
      
      if (project) {
        const isMember = project.members?.some(m => m.user === user.username);
        const isSuperManager = project.superManager === user.username;
        const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
        
        if (!isMember && !isSuperManager && !isAdmin) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    // Check for child folders
    const childFolders = await db.collection('doc_folders').countDocuments({ parentId: new ObjectId(id) });
    if (childFolders > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete folder with subfolders. Please delete subfolders first.' 
      }, { status: 400 });
    }

    // Check for files in folder
    const filesInFolder = await db.collection('resources').countDocuments({ folderId: id });
    if (filesInFolder > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete folder with files. Please move or delete files first.' 
      }, { status: 400 });
    }

    await db.collection('doc_folders').deleteOne({ _id: new ObjectId(id) });

    // Log activity
    await db.collection('doc_activity_logs').insertOne({
      projectId: folder.projectId,
      action: 'folder_deleted',
      targetType: 'folder',
      targetId: new ObjectId(id),
      targetName: folder.name,
      user: {
        userId: user._id,
        username: user.username,
        email: user.email
      },
      details: { path: folder.path },
      timestamp: new Date()
    });

    return NextResponse.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
