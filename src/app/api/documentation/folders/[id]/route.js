import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId, GridFSBucket } from 'mongodb';

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

// DELETE - Delete a folder (with recursive deletion)
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

    // Recursively get all subfolder IDs
    const getSubfolderIds = async (parentId) => {
      const subfolders = await db.collection('doc_folders')
        .find({ parentId: new ObjectId(parentId) })
        .toArray();

      const allIds = [parentId];
      for (const sub of subfolders) {
        const deeperIds = await getSubfolderIds(sub._id);
        allIds.push(...deeperIds);
      }
      return allIds;
    };

    const allFolderIds = await getSubfolderIds(new ObjectId(id));
    const allFolderIdStrings = allFolderIds.map(fid => fid.toString());

    // Get all files in these folders before deletion (for activity log)
    const filesToDelete = await db.collection('resources')
      .find({
        projectId: folder.projectId,
        folderId: { $in: allFolderIdStrings }
      })
      .toArray();

    // Delete all files (handles both GridFS and external files)
    for (const file of filesToDelete) {
      if (file.storageType === 'gridfs') {
        try {
          const bucket = new mongodb.GridFSBucket(client.db('resources'), { bucketName: 'files' });
          await bucket.delete(new ObjectId(file.fileId));
        } catch (err) {
          console.error('Error deleting GridFS file:', err);
        }
      }
      await db.collection('resources').deleteOne({ _id: file._id });
    }

    // Delete all subfolders (recursive)
    await db.collection('doc_folders').deleteMany({ _id: { $in: allFolderIds.map(fid => new ObjectId(fid)) } });

    // Log activity for folder deletion
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
      details: {
        path: folder.path,
        deletedSubfolders: allFolderIds.length - 1,
        deletedFiles: filesToDelete.length
      },
      timestamp: new Date()
    });

    // Log activity for each deleted file
    for (const file of filesToDelete.slice(0, 100)) { // Limit to 100 to avoid excessive logging
      await db.collection('doc_activity_logs').insertOne({
        projectId: folder.projectId,
        action: 'file_delete',
        resourceType: 'file',
        resourceId: file._id,
        resourceName: file.name,
        userId: user._id,
        username: user.username,
        timestamp: new Date(),
        details: { reason: 'parent_folder_deleted', parentFolder: folder.name }
      });
    }

    return NextResponse.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
