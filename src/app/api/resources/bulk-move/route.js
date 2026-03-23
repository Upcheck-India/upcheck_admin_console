// src/app/api/resources/bulk-move/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

/**
 * POST /api/resources/bulk-move
 * Move multiple files to a new project/folder
 */
export async function POST(req) {
  try {
    const { fileIds, projectId, folderId } = await req.json();

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'File IDs are required' }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Target project ID is required' }, { status: 400 });
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

    // Verify user has access to target project
    const targetProject = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!targetProject) {
      return NextResponse.json({ error: 'Target project not found' }, { status: 404 });
    }

    const isTargetMember = targetProject.members?.some(m => m.user === user.username);
    const isTargetSuperManager = targetProject.superManager === user.username;
    const isAdmin = user.role === 'Admin' || user.role === 'Console admin';

    if (!isTargetMember && !isTargetSuperManager && !isAdmin) {
      return NextResponse.json({ error: 'No access to target project' }, { status: 403 });
    }

    // Verify folder if specified
    if (folderId) {
      const targetFolder = await db.collection('doc_folders').findOne({
        _id: new ObjectId(folderId),
        projectId
      });
      if (!targetFolder) {
        return NextResponse.json({ error: 'Target folder not found' }, { status: 404 });
      }
    }

    // Get all files to move with their current info
    const files = await db.collection('resources')
      .find({ _id: { $in: fileIds.map(id => new ObjectId(id)) } })
      .toArray();

    // Verify user has access to move these files
    for (const file of files) {
      const sourceProject = await db.collection('projects').findOne({ _id: new ObjectId(file.projectId) });
      if (sourceProject) {
        const isSourceMember = sourceProject.members?.some(m => m.user === user.username);
        const isSourceSuperManager = sourceProject.superManager === user.username;
        if (!isSourceMember && !isSourceSuperManager && !isAdmin) {
          return NextResponse.json({ error: `No permission to move file: ${file.name}` }, { status: 403 });
        }
      }
    }

    // Move files
    const updateData = {
      projectId,
      folderId: folderId || null,
      updatedAt: new Date(),
    };

    await db.collection('resources').updateMany(
      { _id: { $in: fileIds.map(id => new ObjectId(id)) } },
      { $set: updateData }
    );

    // Log activity for each file
    const logEntries = files.map(file => ({
      projectId,
      resourceId: file._id.toString(),
      action: 'file_move',
      resourceType: 'file',
      resourceName: file.name,
      userId: user._id,
      username: user.username,
      timestamp: new Date(),
      metadata: {
        fromProjectId: file.projectId,
        toProjectId: projectId,
        fromFolderId: file.folderId,
        toFolderId: folderId || null,
        bulkOperation: true,
      },
    }));

    if (logEntries.length > 0) {
      await db.collection('doc_activity_logs').insertMany(logEntries);
    }

    return NextResponse.json({
      success: true,
      message: `Moved ${files.length} file(s) successfully`,
      movedCount: files.length,
    });

  } catch (error) {
    console.error('Error bulk moving files:', error);
    return NextResponse.json({ error: 'Failed to move files' }, { status: 500 });
  }
}
