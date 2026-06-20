// src/app/api/resources/[id]/move/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../../lib/mongodb";
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { canAccessProject, canWriteFile, canCreateInProject, canAccessGeneralSpace, getGeneralSpacePermissionLevel } from '../../../../../lib/projectPermissions';

// Helper to fetch user's teams for permission checking
async function getUserTeams(db, user) {
  const userIdStr = user._id?.toString();
  if (!userIdStr) return [];
  return await db.collection('teams')
    .find({
      $or: [
        { members: userIdStr },
        { lead: userIdStr },
        { members: user._id },
        { lead: user._id },
      ],
    })
    .toArray();
}

export async function PATCH(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { projectId, folderId } = body;

    if (!projectId && folderId === undefined) {
      return NextResponse.json({ error: 'Project ID or folder ID is required' }, { status: 400 });
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

    // Get the resource to find current location
    const resource = await db.collection("resources").findOne({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : id
    });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Fetch user teams for team-based permission checking
    const userTeams = await getUserTeams(db, user);

    // Verify user has permission to move this resource
    let canMove = false;

    if (resource.projectId === 'general') {
      const generalPerms = await db.collection('general_space_permissions').findOne({ _id: 'general' });
      const permSettings = generalPerms?.permissionSettings;

      if (canAccessGeneralSpace(user, permSettings)) {
        const perms = getGeneralSpacePermissionLevel(user, permSettings);
        if (perms && perms.writeScope !== 'none') {
          if (perms.writeScope === 'all') {
            canMove = true;
          } else if (perms.writeScope === 'own') {
            canMove = resource.uploadedBy?.username === user?.username;
          }
        }
      }
    } else if (resource.projectId) {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(resource.projectId) });
      if (project && canAccessProject(user, project, userTeams)) {
        canMove = canWriteFile(user, project, resource, userTeams);
      }
    }

    if (!canMove) {
      return NextResponse.json({ error: 'Not authorized to move this resource' }, { status: 403 });
    }

    const updateFields = { updatedAt: new Date() };

    // Handle project move
    if (projectId !== undefined) {
      if (projectId !== 'general') {
        const project = await db.collection("projects").findOne({
          _id: ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId
        });

        if (!project) {
          return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
      }
      updateFields.projectId = projectId;
    }

    // Handle folder move
    if (folderId !== undefined) {
      // Verify folder exists if provided
      if (folderId) {
        const folder = await db.collection("documentation_folders").findOne({
          _id: ObjectId.isValid(folderId) ? new ObjectId(folderId) : folderId
        });

        if (!folder) {
          return NextResponse.json({ error: 'Destination folder not found' }, { status: 404 });
        }
      }
      updateFields.folderId = folderId || null;
    }

    // Update the resource
    const result = await db.collection("resources").updateOne(
      { _id: ObjectId.isValid(id) ? new ObjectId(id) : id },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Log activity
    try {
      await db.collection('doc_activity_logs').insertOne({
        projectId: updateFields.projectId || resource.projectId,
        resourceId: id,
        action: 'move',
        resourceType: 'file',
        resourceName: resource.name,
        userId: user?._id || null,
        username: user?.username || 'System',
        timestamp: new Date(),
        metadata: {
          fromProjectId: resource.projectId,
          toProjectId: updateFields.projectId,
          fromFolderId: resource.folderId,
          toFolderId: updateFields.folderId,
        }
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error moving resource:', error);
    return NextResponse.json({ error: 'Failed to move resource' }, { status: 500 });
  }
}
