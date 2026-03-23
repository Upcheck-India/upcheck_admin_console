// src/app/api/projects/[id]/preview-delete/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

/**
 * GET /api/projects/:id/preview-delete
 * Get preview of what will be deleted when a project is deleted
 */
export async function GET(req, { params }) {
  try {
    const { id } = await params;

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

    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all folders in this project
    const folders = await db.collection('doc_folders')
      .find({ projectId: id })
      .toArray();

    const folderIds = folders.map(f => f._id.toString());

    // Get all files in this project (including root level files without folderId)
    const files = await db.collection('resources')
      .find({ projectId: id })
      .toArray();

    // Calculate total size
    const totalSize = files.reduce((sum, f) => sum + (f.fileSize || 0), 0);

    // Get member count
    const memberCount = project.members?.length || 0;

    return NextResponse.json({
      project: {
        _id: project._id.toString(),
        name: project.name,
        status: project.status,
        superManager: project.superManager,
      },
      folders: folders.map(f => ({
        _id: f._id.toString(),
        name: f.name,
        path: f.path,
      })),
      files: files.map(f => ({
        _id: f._id.toString(),
        name: f.name,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        folderId: f.folderId,
      })),
      stats: {
        totalFolders: folders.length,
        totalFiles: files.length,
        totalSize,
        memberCount,
      },
    });

  } catch (error) {
    console.error('Error fetching project delete preview:', error);
    return NextResponse.json({ error: 'Failed to fetch project delete preview' }, { status: 500 });
  }
}
