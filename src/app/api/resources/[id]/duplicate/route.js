// src/app/api/resources/[id]/duplicate/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../../lib/mongodb";
import { ObjectId, GridFSBucket } from 'mongodb';
import { cookies } from 'next/headers';

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

    // Verify user has permission to duplicate this resource
    const isAdmin = user?.role === 'Admin' || user?.role === 'Console admin';
    const isOwner = originalResource.uploadedBy?.username === user?.username;
    const isProjectMember = originalResource.projectId && await isMemberOfProject(db, originalResource.projectId, user.username);

    if (!isAdmin && !isOwner && !isProjectMember) {
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

async function isMemberOfProject(db, projectId, username) {
  try {
    const project = await db.collection('projects').findOne({
      _id: ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId
    });
    return project && (
      project.superManager === username ||
      project.members?.some(m => m.user === username)
    );
  } catch {
    return false;
  }
}
