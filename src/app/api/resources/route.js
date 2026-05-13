// src/app/api/resources/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../lib/mongodb";
import { GridFSBucket, ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { canAccessProject, canReadFile, canAccessGeneralSpace, getGeneralSpacePermissionLevel } from '../../../lib/projectPermissions';

// Helper to fetch user's teams for permission checking
async function getUserTeams(db, user) {
  if (!user) return [];
  const userIdStr = user._id?.toString();
  if (!userIdStr) return [];
  return await db.collection('teams')
    .find({
      $or: [
        { members: userIdStr },
        { lead: userIdStr },
      ],
    })
    .toArray();
}

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

    // Fetch user teams for team-based permission checking
    const userTeams = await getUserTeams(db, user);

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
      fileSize: file.metadata?.fileSize || file.length,
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
      alternativeLinks: {},
      uploadedBy: {
        username: file.metadata?.uploadedByUsername || file.metadata?.uploadedBy || 'System',
        email: file.metadata?.uploadedByEmail || '',
      },
    }));

    // Combine both sources
    const allResources = [...resourcesCollection, ...resourcesFromGridFS];

    // Filter resources by project access permissions
    if (projectId && projectId !== 'general') {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
      if (project && !canAccessProject(user, project, userTeams)) {
        // User doesn't have access to this project
        return NextResponse.json([]);
      }
    }

    // Process resources - remove sensitive data and check read permissions
    const processedResources = [];
    for (const resource of allResources) {
      // Check project-level access
      if (resource.projectId === 'general') {
        // For General space, fetch permissions from database
        const generalPerms = await db.collection('general_space_permissions').findOne({ _id: 'general' });
        const permSettings = generalPerms?.permissionSettings;

        if (!canAccessGeneralSpace(user, permSettings)) {
          continue; // Skip this resource - user doesn't have access to General space
        }

        // Check file-level read permissions for General space
        const perms = getGeneralSpacePermissionLevel(user, permSettings);
        if (perms) {
          if (perms.readScope === 'own') {
            // Can only read own files
            const isOwnFile = resource.createdBy === user.username || resource.createdBy === user._id?.toString() || resource.ownerId === user._id?.toString();
            if (!isOwnFile) {
              continue;
            }
          } else if (perms.readScope === 'none') {
            continue; // Cannot read any files
          }
          // readScope === 'all' - can read all files
        } else {
          continue; // No permissions
        }
      } else if (resource.projectId) {
        const project = await db.collection('projects').findOne({ _id: new ObjectId(resource.projectId) });
        if (project && !canAccessProject(user, project, userTeams)) {
          continue; // Skip this resource - user doesn't have access to project
        }

        // Check file-level read permissions
        if (project && !canReadFile(user, project, resource, userTeams)) {
          continue; // Skip this resource - user cannot read this file
        }
      }

      // Return safe resource object (without password hash)
      const { passwordHash, ...safeResource } = resource;

      // Add canDownload flag based on permissions
      safeResource.canDownload = true; // Already filtered by canReadFile above

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