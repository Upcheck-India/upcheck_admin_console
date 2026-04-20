// src/app/api/share/[token]/download/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId, GridFSBucket } from 'mongodb';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

/**
 * GET /api/share/[token]/download
 * Download a file from a shared resource with proper access validation
 */
export async function GET(req, { params }) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Get share record
    const share = await db.collection('shared_resources').findOne({ token });

    if (!share) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    // Check if share is active
    if (!share.active) {
      return NextResponse.json({ error: 'This share link has been deactivated' }, { status: 403 });
    }

    // Check expiry
    if (share.expiresAt && new Date() > new Date(share.expiresAt)) {
      return NextResponse.json({ error: 'This share link has expired' }, { status: 403 });
    }

    // Get resource
    const resource = await db.collection('resources').findOne({ _id: share.resourceId });
    if (!resource) {
      return NextResponse.json({ error: 'Shared resource not found' }, { status: 404 });
    }

    // Check if user is authenticated
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token')?.value;
    const verifiedShares = JSON.parse(cookieStore.get('verified_shares')?.value || '{}');
    let user = null;

    if (adminToken) {
      user = await db.collection('admin_users').findOne({ sessionToken: adminToken });
    }

    // Check access permissions
    let hasAccess = false;

    // Admins always have access
    if (user && (user.role === 'Admin' || user.role === 'Console admin')) {
      hasAccess = true;
    }
    // Password verified (for any password-protected share)
    else if (share.requirePassword && verifiedShares[token]) {
      hasAccess = true;
    }
    // Public links without password
    else if (share.isPublic && !share.requirePassword) {
      hasAccess = true;
    }
    // Authorized members (with or without password - password verified separately)
    else if (user && share.allowedMembers && share.allowedMembers.length > 0) {
      if (share.allowedMembers.includes(user.email) || share.allowedMembers.includes(user.username)) {
        hasAccess = true;
      }
    }

    // CRITICAL: Deny access if user doesn't have permission
    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have permission to download this file' }, { status: 403 });
    }

    // Handle external storage
    if (resource.storageProvider && resource.storageProvider !== 'server' && resource.externalUrl) {
      return NextResponse.redirect(resource.externalUrl);
    }

    // Stream from GridFS
    if (!resource.fileId) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
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
          { _id: share.resourceId },
          { $inc: { downloads: 1 } }
        );

        // Log the download activity
        try {
          db.collection('doc_activity_logs').insertOne({
            projectId: resource.projectId,
            resourceId: share.resourceId.toString(),
            action: 'download',
            resourceType: 'file',
            resourceName: resource.name,
            userId: user?._id || null,
            username: user?.username || 'Anonymous (shared link)',
            timestamp: new Date(),
            metadata: {
              viaShareLink: true,
              shareToken: token,
            }
          });
        } catch (logError) {
          console.error('Failed to log activity:', logError);
        }

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
          NextResponse.json({ error: 'Failed to download file', details: error.message }, { status: 500 })
        );
      });
    });

  } catch (error) {
    console.error('Shared download error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
