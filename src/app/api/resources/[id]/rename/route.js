// src/app/api/resources/[id]/rename/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../../lib/mongodb";
import { ObjectId, GridFSBucket } from 'mongodb';
import { cookies } from 'next/headers';

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const { name } = await req.json();

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid resource ID" }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "File name is required" }, { status: 400 });
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

    // Get the resource
    const resource = await db.collection('resources').findOne({ _id: new ObjectId(id) });

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Verify user has permission to rename this resource
    const isAdmin = user?.role === 'Admin' || user?.role === 'Console admin';
    const isOwner = resource.uploadedBy?.username === user?.username;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Not authorized to rename this resource' }, { status: 403 });
    }

    // Update the resource name
    const result = await db.collection('resources').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          name: name.trim(),
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Also update the filename in GridFS metadata
    if (resource.fileId) {
      const bucket = new GridFSBucket(db);
      await bucket.updateMetadata(resource.fileId, {
        $set: { name: name.trim() }
      });
    }

    // Log activity
    try {
      await db.collection('doc_activity_logs').insertOne({
        projectId: resource.projectId,
        resourceId: id,
        action: 'rename',
        resourceType: 'file',
        resourceName: name.trim(),
        userId: user?._id || null,
        username: user?.username || 'System',
        timestamp: new Date(),
        metadata: {
          oldName: resource.name,
          newName: name.trim(),
        }
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }

    return NextResponse.json({
      success: true,
      message: "Resource renamed successfully"
    });

  } catch (error) {
    console.error('Rename error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
