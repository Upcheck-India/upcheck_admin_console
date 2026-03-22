// src/app/api/resources/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../lib/mongodb";
import { GridFSBucket } from 'mongodb';

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    
    // Build query filter
    const query = {};
    if (projectId) {
      query.projectId = projectId;
    }
    
    // Filter by folderId if provided
    const folderId = searchParams.get('folderId');
    if (folderId) {
      query.folderId = folderId;
    }
    
    // Fetch resources from the collection
    const resourcesCollection = await db.collection('resources').find(query).toArray();
    
    // Also fetch files from GridFS that may not be in the resources collection
    // but are marked as documentation resources
    const bucket = new GridFSBucket(db);
    const gridFSQuery = { "metadata.isDocumentationResource": true };
    if (projectId) {
      gridFSQuery["metadata.projectId"] = projectId;
    }
    const filesCursor = bucket.find(gridFSQuery);
    
    const filesFromGridFS = await filesCursor.toArray();
    
    // Map GridFS files to the same format as resources
    const resourcesFromGridFS = filesFromGridFS
    .filter(file => {
      // Only include files that don't have a corresponding entry in resources collection
      return !resourcesCollection.some(r =>
        r.fileId && r.fileId.toString() === file._id.toString()
      );
    })
    .map(file => ({
      fileId: file._id,
      name: file.metadata?.name || file.filename,
      originalName: file.filename,
      mimeType: file.contentType,
      fileSize: file.metadata?.fileSize || formatFileSize(file.length),
      fileSizeBytes: file.length,
      category: file.metadata?.category || 'documents',
      description: file.metadata?.description || '',
      projectId: file.metadata?.projectId,
      folderId: file.metadata?.folderId || null,
      downloads: 0,
      createdAt: file.uploadDate,
      updatedAt: file.uploadDate,
      // Add default storageOptions for GridFS files
      storageOptions: ['server'],
      alternativeLinks: {}
    }));
    
    // Combine both sources
    const allResources = [...resourcesCollection, ...resourcesFromGridFS];
    
    return NextResponse.json(allResources);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  else return (bytes / 1073741824).toFixed(1) + ' GB';
}