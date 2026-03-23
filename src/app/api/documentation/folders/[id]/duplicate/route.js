// src/app/api/documentation/folders/[id]/duplicate/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

/**
 * POST /api/documentation/folders/:id/duplicate
 * Duplicate a folder with all its contents (subfolders and files)
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
    }

    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sourceFolder = await db.collection('doc_folders').findOne({ _id: new ObjectId(id) });
    if (!sourceFolder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Check access
    if (sourceFolder.projectId !== 'general') {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(sourceFolder.projectId) });
      if (project) {
        const isMember = project.members?.some(m => m.user === user.username);
        const isSuperManager = project.superManager === user.username;
        const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
        if (!isMember && !isSuperManager && !isAdmin) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    const { targetProjectId, targetParentId } = await req.json();
    const destProjectId = targetProjectId || sourceFolder.projectId;

    // Verify target project access
    if (destProjectId !== 'general') {
      const targetProject = await db.collection('projects').findOne({ _id: new ObjectId(destProjectId) });
      if (targetProject) {
        const isMember = targetProject.members?.some(m => m.user === user.username);
        const isSuperManager = targetProject.superManager === user.username;
        const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
        if (!isMember && !isSuperManager && !isAdmin) {
          return NextResponse.json({ error: 'No access to target project' }, { status: 403 });
        }
      }
    }

    // Verify target parent folder if specified
    if (targetParentId) {
      const targetParent = await db.collection('doc_folders').findOne({
        _id: new ObjectId(targetParentId),
        projectId: destProjectId
      });
      if (!targetParent) {
        return NextResponse.json({ error: 'Target parent folder not found' }, { status: 404 });
      }
    }

    // Recursively duplicate folders
    const folderIdMap = new Map(); // oldId -> newId

    const duplicateFolder = async (sourceFolderId, destParentId) => {
      const source = await db.collection('doc_folders').findOne({ _id: new ObjectId(sourceFolderId) });
      if (!source) return null;

      const newFolder = {
        name: source.name + ' (Copy)',
        projectId: destProjectId,
        parentId: destParentId ? new ObjectId(destParentId) : null,
        path: source.path,
        description: source.description,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('doc_folders').insertOne(newFolder);
      const newId = result.insertedId.toString();
      folderIdMap.set(sourceFolderId.toString(), newId);

      // Duplicate subfolders
      const subfolders = await db.collection('doc_folders')
        .find({ parentId: new ObjectId(sourceFolderId) })
        .toArray();

      for (const sub of subfolders) {
        await duplicateFolder(sub._id.toString(), newId);
      }

      return newId;
    };

    // Start duplication
    const newRootId = await duplicateFolder(id, targetParentId);

    // Duplicate files - get all files in source folder and subfolders
    const getAllSubfolderIds = async (folderId) => {
      const subfolders = await db.collection('doc_folders')
        .find({ parentId: new ObjectId(folderId) })
        .toArray();

      const allIds = [folderId];
      for (const sub of subfolders) {
        const deeper = await getAllSubfolderIds(sub._id.toString());
        allIds.push(...deeper);
      }
      return allIds;
    };

    const allSourceFolderIds = await getAllSubfolderIds(id);
    const files = await db.collection('resources')
      .find({
        projectId: sourceFolder.projectId,
        folderId: { $in: allSourceFolderIds }
      })
      .toArray();

    // Duplicate each file
    for (const file of files) {
      const newFolderId = folderIdMap.get(file.folderId);

      // For GridFS files, we need to duplicate the actual file
      if (file.fileId && file.storageProvider === 'server') {
        const bucket = new db.GridFSBucket(db, { bucketName: 'fs' });
        const downloadStream = bucket.openDownloadStream(new ObjectId(file.fileId));

        const chunks = [];
        await new Promise((resolve, reject) => {
          downloadStream.on('data', chunk => chunks.push(chunk));
          downloadStream.on('end', resolve);
          downloadStream.on('error', reject);
        });
        const buffer = Buffer.concat(chunks);

        // Upload duplicate
        const uploadStream = bucket.openUploadStream(file.name, {
          metadata: {
            projectId: destProjectId,
            folderId: newFolderId || targetParentId || null,
            originalId: file._id.toString(),
          }
        });

        await new Promise((resolve, reject) => {
          uploadStream.end(buffer, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // Create resource record
        await db.collection('resources').insertOne({
          name: file.name + ' (Copy)',
          projectId: destProjectId,
          folderId: newFolderId || targetParentId || null,
          fileId: uploadStream.id,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          storageProvider: 'server',
          isPasswordProtected: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        // For external files, just create a new record
        await db.collection('resources').insertOne({
          name: file.name,
          projectId: destProjectId,
          folderId: newFolderId || targetParentId || null,
          externalUrl: file.externalUrl,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          storageProvider: file.storageProvider || 'external',
          isPasswordProtected: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Log activity
    await db.collection('doc_activity_logs').insertOne({
      projectId: destProjectId,
      action: 'folder_duplicate',
      targetType: 'folder',
      targetName: sourceFolder.name,
      user: {
        userId: user._id,
        username: user.username,
        email: user.email
      },
      metadata: {
        sourceFolderId: id,
        newFolderId: newRootId,
        duplicatedFoldersCount: folderIdMap.size,
        duplicatedFilesCount: files.length,
      },
      timestamp: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Folder duplicated successfully',
      newFolderId: newRootId,
      duplicatedFoldersCount: folderIdMap.size,
      duplicatedFilesCount: files.length,
    });

  } catch (error) {
    console.error('Error duplicating folder:', error);
    return NextResponse.json({ error: 'Failed to duplicate folder' }, { status: 500 });
  }
}
