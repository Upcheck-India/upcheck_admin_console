// src/app/api/resources/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../lib/mongodb";
import { GridFSBucket } from 'mongodb';
import { cookies } from 'next/headers';

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");

    // Get auth token for permission checking
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    let user = null;

    if (token) {
      user = await db.collection('admin_users').findOne({ sessionToken: token });
    }

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
      storageProvider: file.metadata?.storageProvider || 'server',
      downloads: 0,
      createdAt: file.uploadDate,
      updatedAt: file.uploadDate,
      isPasswordProtected: false,
      alternativeLinks: {}
    }));

    // Combine both sources
    const allResources = [...resourcesCollection, ...resourcesFromGridFS];

    // Check user permissions for download access
    const isAdmin = user?.role === 'Admin' || user?.role === 'Console admin';

    // Get server settings for intern restrictions
    let serverSettings = null;
    let allowInternDownload = true;
    let allowedProjectsForDownload = [];

    if (!isAdmin && user?.role === 'Intern') {
      serverSettings = await db.collection('server_settings').findOne({});
      allowInternDownload = serverSettings?.allowInternDownload !== false;
      allowedProjectsForDownload = serverSettings?.allowedProjectsForDownload || [];
    }

    // Process resources - remove sensitive data and check access
    const processedResources = [];
    for (const resource of allResources) {
      // For non-admin users, check download permissions
      if (!isAdmin && user?.role === 'Intern' && !allowInternDownload) {
        // Check if resource is in allowed projects/documents
        const isAllowed = allowedProjectsForDownload.includes(resource.projectId);
        if (!isAllowed) {
          continue; // Skip this resource
        }
      }

      // Return safe resource object (without password hash)
      const { passwordHash, ...safeResource } = resource;

      // Add canDownload flag based on permissions
      safeResource.canDownload = isAdmin || allowInternDownload || !resource.isPasswordProtected;

      processedResources.push(safeResource);
    }

    return NextResponse.json(processedResources);
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