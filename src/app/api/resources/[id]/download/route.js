// src/app/api/resources/[id]/download/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../../lib/mongodb";
import { ObjectId, GridFSBucket } from 'mongodb';
import { cookies } from 'next/headers';

/**
 * GET /api/resources/[id]/download
 * Download a file from GridFS
 */
export async function GET(req, { params }) {
  try {
    const { id } = params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid resource ID" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Get auth token first
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    const verifiedResources = JSON.parse(cookieStore.get('verified_resources')?.value || '{}');

    // Get the resource
    const resource = await db.collection('resources').findOne({ _id: new ObjectId(id) });

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Check password protection
    if (resource.isPasswordProtected && resource.passwordHash) {
      if (!verifiedResources[id]) {
        return NextResponse.json(
          { error: "Password required", requiresPassword: true },
          { status: 403 }
        );
      }
    }

    // Get user for permissions
    let user = null;
    if (token) {
      user = await db.collection('admin_users').findOne({ sessionToken: token });
    }

    const isAdmin = user?.role === 'Admin' || user?.role === 'Console admin';

    if (!isAdmin && user?.role === 'Intern') {
      const serverSettings = await db.collection('server_settings').findOne({});
      if (!serverSettings?.allowInternDownload) {
        return NextResponse.json({ error: "Download not allowed for your role" }, { status: 403 });
      }
      const allowedProjects = serverSettings?.allowedProjectsForDownload || [];
      if (resource.projectId && !allowedProjects.includes(resource.projectId)) {
        return NextResponse.json({ error: "Access denied to this resource" }, { status: 403 });
      }
    }

    // Handle external storage providers
    if (resource.storageProvider && resource.storageProvider !== 'server' && resource.externalUrl) {
      return NextResponse.redirect(resource.externalUrl);
    }

    // Stream from GridFS
    if (!resource.fileId) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const bucket = new GridFSBucket(db);
    const downloadStream = bucket.openDownloadStream(resource.fileId);

    return new Promise((resolve) => {
      const chunks = [];

      downloadStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      downloadStream.on('end', () => {
        const buffer = Buffer.concat(chunks);

        // Increment download count
        db.collection('resources').updateOne(
          { _id: new ObjectId(id) },
          { $inc: { downloads: 1 } }
        );

        resolve(
          new NextResponse(buffer, {
            headers: {
              'Content-Type': resource.mimeType || 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${resource.name}"`,
              'Cache-Control': 'public, max-age=3600',
            },
          })
        );
      });

      downloadStream.on('error', (error) => {
        resolve(
          NextResponse.json({ error: "Failed to download file", details: error.message }, { status: 500 })
        );
      });
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
