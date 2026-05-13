// src/app/api/resources/[id]/duplicate/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../../lib/mongodb";
import { ObjectId, GridFSBucket } from 'mongodb';
import { cookies } from 'next/headers';
import { canAccessProject, canCreateInProject, canReadFile, canAccessGeneralSpace, getGeneralSpacePermissionLevel } from '../../../../../lib/projectPermissions';

// Helper to fetch user's teams for permission checking
async function getUserTeams(db, user) {
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

export async function POST(req, { params }) {
  try {
    const { id } = params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid resource ID" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Get auth token for permissions and activity logging
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    let user = null;

    if (token) {
      user = await db.collection('admin_users').findOne({ sessionToken: token });
    }

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Get the original resource
    const originalResource = await db.collection('resources').findOne({ _id: new ObjectId(id) });

    if (!originalResource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Fetch user teams for team-based permission checking
    const userTeams = await getUserTeams(db, user);

    // Verify user has permission to duplicate this resource
    let canDuplicate = false;

    if (originalResource.projectId === 'general') {
      const generalPerms = await db.collection('general_space_permissions').findOne({ _id: 'general' });
      const permSettings = generalPerms?.permissionSettings;

      if (canAccessGeneralSpace(user, permSettings)) {
        const perms = getGeneralSpacePermissionLevel(user, permSettings);
        if (perms && perms.readScope !== 'none' && perms.writeScope !== 'none') {
          if (perms.readScope === 'all' && perms.writeScope === 'all') {
            canDuplicate = true;
          } else if (perms.readScope === 'own' && perms.writeScope === 'own') {
            canDuplicate = originalResource.uploadedBy?.username === user?.username;
          } else if (perms.readScope === 'all' && perms.writeScope === 'own') {
            // Can read but only write own
            canDuplicate = originalResource.uploadedBy?.username === user?.username;
          } else if (perms.readScope === 'own' && perms.writeScope === 'all') {
            // Can read own but write all (unusual but possible)
            canDuplicate = originalResource.uploadedBy?.username === user?.username;
          }
        }
      }
    } else if (originalResource.projectId) {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(originalResource.projectId) });
      if (project && canAccessProject(user, project, userTeams)) {
        // Must be able to read the file AND create new files in the project
        const canRead = canReadFile(user, project, originalResource, userTeams);
        const canCreate = canCreateInProject(user, project, userTeams);
        canDuplicate = canRead && canCreate;
      }
    }

    if (!canDuplicate) {
      return NextResponse.json({ error: 'Not authorized to duplicate this resource' }, { status: 403 });
    }

    // Generate new filename with "copy" suffix
    const nameParts = originalResource.name.split('.');
    const ext = nameParts.length > 1 ? nameParts.pop() : '';
    const baseName = nameParts.join('.');
    const newName = ext ? `${baseName} (Copy).${ext}` : `${baseName} (Copy)`;

    // Duplicate the file in GridFS if it exists
    let newFileId = null;
    if (originalResource.fileId) {
      const bucket = new GridFSBucket(db);
      const downloadStream = bucket.openDownloadStream(originalResource.fileId);

      const chunks = [];
      await new Promise((resolve, reject) => {
        downloadStream.on('data', (chunk) => chunks.push(chunk));
        downloadStream.on('end', resolve);
        downloadStream.on('error', reject);
      });

      const buffer = Buffer.concat(chunks);

      // Upload to GridFS with new metadata
      const uploadStream = bucket.openUploadStream(newName, {
        metadata: {
          ...originalResource.metadata,
          name: newName,
          originalName: newName,
          duplicatedFrom: id,
          duplicatedAt: new Date(),
          duplicatedBy: user.username,
        }
      });

      await new Promise((resolve, reject) => {
        uploadStream.end(buffer, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      newFileId = uploadStream.id;
    }

    // Create new resource record
    const newResource = {
      ...originalResource,
      _id: new ObjectId(),
      fileId: newFileId,
      name: newName,
      originalName: newName,
      downloads: 0,
      isPasswordProtected: false,
      passwordHash: null,
      uploadedBy: {
        username: user.username,
        email: user.email,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      duplicatedFrom: id,
    };

    // Remove fields that shouldn't be duplicated
    delete newResource._id;

    const result = await db.collection('resources').insertOne(newResource);

    // Log activity
    try {
      await db.collection('doc_activity_logs').insertOne({
        projectId: originalResource.projectId,
        resourceId: result.insertedId.toString(),
        action: 'duplicate',
        resourceType: 'file',
        resourceName: newName,
        userId: user._id,
        username: user.username,
        timestamp: new Date(),
        metadata: {
          originalResourceId: id,
          originalResourceName: originalResource.name,
        }
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }

    return NextResponse.json({
      success: true,
      message: "Resource duplicated successfully",
      resourceId: result.insertedId.toString(),
      name: newName,
    });

  } catch (error) {
    console.error('Duplicate error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

