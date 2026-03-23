// src/app/api/share/[token]/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

/**
 * GET /api/share/[token]
 * Get share info by token
 */
export async function GET(req, { params }) {
  try {
    const { token } = params;

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
    const cookieStore = cookies();
    const adminToken = cookieStore.get('admin_token')?.value;
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
    // Public links
    else if (share.isPublic && !share.requirePassword) {
      hasAccess = true;
    }
    // Authorized members
    else if (user && share.allowedMembers && share.allowedMembers.length > 0) {
      if (share.allowedMembers.includes(user.email) || share.allowedMembers.includes(user.username)) {
        hasAccess = true;
      }
    }

    // Increment view count if accessed
    if (hasAccess) {
      await db.collection('shared_resources').updateOne(
        { _id: share._id },
        { $inc: { views: 1 } }
      );
    }

    // Return share info (without password hash)
    const { passwordHash, ...safeShare } = share;

    return NextResponse.json({
      ...safeShare,
      _id: safeShare._id.toString(),
      resource: {
        _id: resource._id.toString(),
        name: resource.name,
        mimeType: resource.mimeType,
        fileSize: resource.fileSize,
        storageProvider: resource.storageProvider,
        externalUrl: resource.externalUrl,
      },
      hasAccess,
      requiresPassword: share.requirePassword,
    });

  } catch (error) {
    console.error('Share fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
