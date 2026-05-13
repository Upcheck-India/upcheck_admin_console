// src/app/api/resources/[id]/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";
import { ObjectId, GridFSBucket } from 'mongodb';
import { canAccessProject, canDeleteFile, canAccessGeneralSpace, getGeneralSpacePermissionLevel } from "../../../../lib/projectPermissions";

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

export async function DELETE(req, { params }) {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ sessionToken: token });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user teams for team-based permission checking
    const userTeams = await getUserTeams(db, user);

    const { id } = params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid resource ID" }, { status: 400 });
    }

    // First, get the resource to find its fileId
    const resource = await db.collection('resources').findOne({ _id: new ObjectId(id) });

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Check project-level access
    if (resource.projectId === 'general') {
      // For General space, fetch permissions from database
      const generalPerms = await db.collection('general_space_permissions').findOne({ _id: 'general' });
      const permSettings = generalPerms?.permissionSettings;

      // Check if user can access General space
      if (!canAccessGeneralSpace(user, permSettings)) {
        return NextResponse.json({ error: "Access denied to General space" }, { status: 403 });
      }

      // Check if user can delete this file
      const perms = getGeneralSpacePermissionLevel(user, permSettings);
      if (!perms) {
        return NextResponse.json({ error: "You do not have permission to delete this file" }, { status: 403 });
      }

      // Full access (all scopes) can delete everything
      if (perms.readScope === 'all' && perms.writeScope === 'all' && perms.downloadScope === 'all') {
        // Can delete any file
      } else if (perms.writeScope === 'own' || perms.writeScope === 'all') {
        // Can only delete own files
        const isOwnFile = resource.createdBy === user.username || resource.createdBy === user._id?.toString() || resource.ownerId === user._id?.toString();
        if (!isOwnFile) {
          return NextResponse.json({ error: "You can only delete your own files" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "You do not have permission to delete files" }, { status: 403 });
      }
    } else if (resource.projectId) {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(resource.projectId) });
      if (project) {
        // Check if user can access the project
        if (!canAccessProject(user, project, userTeams)) {
          return NextResponse.json({ error: "Access denied to this project" }, { status: 403 });
        }

        // Check if user can delete this file
        if (!canDeleteFile(user, project, resource, userTeams)) {
          return NextResponse.json({ error: "You do not have permission to delete this file" }, { status: 403 });
        }
      }
    }

    // Delete from resources collection
    await db.collection('resources').deleteOne({ _id: new ObjectId(id) });

    // Delete the file from GridFS if fileId exists
    if (resource.fileId) {
      const bucket = new GridFSBucket(db);
      await bucket.delete(resource.fileId);
    }

    return NextResponse.json({
      success: true,
      message: "Resource deleted successfully"
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}