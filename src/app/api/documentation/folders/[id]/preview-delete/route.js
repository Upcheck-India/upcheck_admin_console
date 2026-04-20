// src/app/api/documentation/folders/[id]/preview-delete/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

/**
 * GET /api/documentation/folders/:id/preview-delete
 * Get preview of what will be deleted when a folder is deleted
 */
export async function GET(req, { params }) {
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

    const folder = await db.collection('doc_folders').findOne({ _id: new ObjectId(id) });
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Recursively get all subfolders
    const getSubfolders = async (parentId) => {
      const subfolders = await db.collection('doc_folders')
        .find({ parentId: new ObjectId(parentId) })
        .toArray();

      const allSubfolders = [...subfolders];
      for (const sub of subfolders) {
        const deeper = await getSubfolders(sub._id);
        allSubfolders.push(...deeper);
      }
      return allSubfolders;
    };

    const allSubfolders = await getSubfolders(id);
    const subfolderIds = [id, ...allSubfolders.map(f => f._id.toString())];

    // Get all files in the folder and subfolders
    const files = await db.collection('resources')
      .find({
        projectId: folder.projectId,
        folderId: { $in: subfolderIds }
      })
      .toArray();

    // Calculate total size
    const totalSize = files.reduce((sum, f) => sum + (f.fileSize || 0), 0);

    return NextResponse.json({
      folder: {
        _id: folder._id.toString(),
        name: folder.name,
        path: folder.path,
      },
      subfolders: allSubfolders.map(f => ({
        _id: f._id.toString(),
        name: f.name,
        path: f.path,
      })),
      files: files.map(f => ({
        _id: f._id.toString(),
        name: f.name,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
      })),
      stats: {
        totalFolders: allSubfolders.length + 1,
        totalFiles: files.length,
        totalSize,
      },
    });

  } catch (error) {
    console.error('Error fetching folder delete preview:', error);
    return NextResponse.json({ error: 'Failed to fetch folder delete preview' }, { status: 500 });
  }
}
