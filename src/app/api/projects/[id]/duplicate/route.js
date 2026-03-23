// src/app/api/projects/[id]/duplicate/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

/**
 * POST /api/projects/:id/duplicate
 * Duplicate a project with all its contents (folders and files)
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { name: newProjectName } = await req.json();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
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

    const sourceProject = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!sourceProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check access - only super manager or admin can duplicate
    const isSuperManager = sourceProject.superManager === user.username;
    const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
    if (!isSuperManager && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Create new project
    const newProject = {
      name: newProjectName || `${sourceProject.name} (Copy)`,
      description: sourceProject.description,
      logo: sourceProject.logo,
      githubRepoUrl: sourceProject.githubRepoUrl,
      status: sourceProject.status || 'ideation',
      superManager: user.username,
      members: [], // Don't copy members by default
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const projectResult = await db.collection('projects').insertOne(newProject);
    const newProjectId = projectResult.insertedId.toString();

    // Duplicate folders
    const sourceFolders = await db.collection('doc_folders')
      .find({ projectId: id })
      .toArray();

    const folderIdMap = new Map(); // oldId -> newId

    // Build folder hierarchy
    const folderTree = new Map();
    for (const folder of sourceFolders) {
      const pid = folder.parentId?.toString() || 'root';
      if (!folderTree.has(pid)) folderTree.set(pid, []);
      folderTree.get(pid).push(folder);
    }

    // Duplicate folders recursively
    const duplicateFolders = async (parentId, newParentId) => {
      const children = folderTree.get(parentId?.toString() || 'root') || [];
      for (const folder of children) {
        const newFolder = {
          name: folder.name,
          projectId: newProjectId,
          parentId: newParentId ? new ObjectId(newParentId) : null,
          path: folder.path,
          description: folder.description,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await db.collection('doc_folders').insertOne(newFolder);
        const newId = result.insertedId.toString();
        folderIdMap.set(folder._id.toString(), newId);

        await duplicateFolders(folder._id, newId);
      }
    };

    await duplicateFolders(null, null);

    // Duplicate files
    const sourceFiles = await db.collection('resources')
      .find({ projectId: id })
      .toArray();

    for (const file of sourceFiles) {
      const newFolderId = file.folderId ? folderIdMap.get(file.folderId.toString()) : null;

      if (file.fileId && file.storageProvider === 'server') {
        // Duplicate GridFS file
        try {
          const bucket = new db.GridFSBucket(db, { bucketName: 'fs' });
          const downloadStream = bucket.openDownloadStream(new ObjectId(file.fileId));

          const chunks = [];
          await new Promise((resolve, reject) => {
            downloadStream.on('data', chunk => chunks.push(chunk));
            downloadStream.on('end', resolve);
            downloadStream.on('error', reject);
          });
          const buffer = Buffer.concat(chunks);

          const uploadStream = bucket.openUploadStream(file.name, {
            metadata: {
              projectId: newProjectId,
              folderId: newFolderId || null,
              originalId: file._id.toString(),
            }
          });

          await new Promise((resolve, reject) => {
            uploadStream.end(buffer, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });

          await db.collection('resources').insertOne({
            name: file.name,
            projectId: newProjectId,
            folderId: newFolderId || null,
            fileId: uploadStream.id,
            mimeType: file.mimeType,
            fileSize: file.fileSize,
            storageProvider: 'server',
            isPasswordProtected: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } catch (fileError) {
          console.error(`Failed to duplicate file ${file.name}:`, fileError);
        }
      } else {
        // External file
        await db.collection('resources').insertOne({
          name: file.name,
          projectId: newProjectId,
          folderId: newFolderId || null,
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
      projectId: newProjectId,
      action: 'project_duplicate',
      resourceType: 'project',
      resourceName: newProject.name,
      userId: user._id,
      username: user.username,
      timestamp: new Date(),
      metadata: {
        sourceProjectId: id,
        newProjectId,
        duplicatedFoldersCount: sourceFolders.length,
        duplicatedFilesCount: sourceFiles.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Project duplicated successfully',
      newProjectId,
      newProject: {
        _id: newProjectId,
        name: newProject.name,
      },
      duplicatedFoldersCount: sourceFolders.length,
      duplicatedFilesCount: sourceFiles.length,
    });

  } catch (error) {
    console.error('Error duplicating project:', error);
    return NextResponse.json({ error: 'Failed to duplicate project' }, { status: 500 });
  }
}
