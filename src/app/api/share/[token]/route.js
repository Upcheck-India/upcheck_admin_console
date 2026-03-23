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
    // Public links (anyone with the link can access - password verified at download)
    else if (share.isPublic) {
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

/**
 * PUT /api/share/[token]
 * Update share link settings
 */
export async function PUT(req, { params }) {
  try {
    const { token } = await params;
    const { isPublic, expirySeconds, allowedMembers, requirePassword, password } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Get auth token
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token')?.value;

    if (!adminToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify user
    const user = await db.collection('admin_users').findOne({ sessionToken: adminToken });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get share record
    const share = await db.collection('shared_resources').findOne({ token });
    if (!share) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    // Verify ownership
    if (share.createdBy.username !== user.username && user.role !== 'Admin' && user.role !== 'Console admin') {
      return NextResponse.json({ error: 'Not authorized to modify this share link' }, { status: 403 });
    }

    // Build update object
    const updateData = {
      isPublic: isPublic ?? share.isPublic,
      allowedMembers: allowedMembers ?? share.allowedMembers,
      requirePassword: requirePassword ?? share.requirePassword,
      updatedAt: new Date(),
    };

    // Set expiry
    if (expirySeconds !== undefined) {
      if (expirySeconds) {
        updateData.expiresAt = new Date(Date.now() + expirySeconds * 1000);
      } else {
        updateData.expiresAt = null;
      }
    }

    // Hash password if provided
    if (requirePassword && password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    } else if (requirePassword === false) {
      updateData.passwordHash = null;
    }

    // Update share record
    await db.collection('shared_resources').updateOne(
      { _id: share._id },
      { $set: updateData }
    );

    // Log activity
    try {
      const resource = await db.collection('resources').findOne({ _id: share.resourceId });
      await db.collection('doc_activity_logs').insertOne({
        projectId: resource?.projectId || share.projectId,
        resourceId: share.resourceId.toString(),
        action: 'share_update',
        resourceType: 'file',
        resourceName: share.resourceName,
        userId: user._id,
        username: user.username,
        timestamp: new Date(),
        metadata: {
          shareToken: token,
          changes: updateData,
        }
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }

    // Get updated share record
    const updatedShare = await db.collection('shared_resources').findOne({ token });

    return NextResponse.json({
      ...updatedShare,
      _id: updatedShare._id.toString(),
    });

  } catch (error) {
    console.error('Share update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/share/[token]
 * Delete a share link
 */
export async function DELETE(req, { params }) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Get auth token
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token')?.value;

    if (!adminToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify user
    const user = await db.collection('admin_users').findOne({ sessionToken: adminToken });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get share record
    const share = await db.collection('shared_resources').findOne({ token });
    if (!share) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    // Verify ownership
    if (share.createdBy.username !== user.username && user.role !== 'Admin' && user.role !== 'Console admin') {
      return NextResponse.json({ error: 'Not authorized to delete this share link' }, { status: 403 });
    }

    // Delete share record
    await db.collection('shared_resources').deleteOne({ token });

    // Log activity
    try {
      await db.collection('doc_activity_logs').insertOne({
        projectId: share.projectId,
        resourceId: share.resourceId.toString(),
        action: 'share_delete',
        resourceType: 'file',
        resourceName: share.resourceName,
        userId: user._id,
        username: user.username,
        timestamp: new Date(),
        metadata: {
          shareToken: token,
          deletedBy: user.username,
        }
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }

    return NextResponse.json({ success: true, message: 'Share link deleted' });

  } catch (error) {
    console.error('Share delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
