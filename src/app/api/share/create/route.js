// src/app/api/share/create/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';

/**
 * POST /api/share/create
 * Create a new share link for a resource
 */
export async function POST(req) {
  try {
    const { resourceId, isPublic = false, allowedMembers = [] } = await req.json();

    if (!resourceId) {
      return NextResponse.json({ error: 'Resource ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Get auth token
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify user
    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Verify resource exists
    const resource = await db.collection('resources').findOne({ _id: new ObjectId(resourceId) });
    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Generate unique token
    const tokenValue = crypto.randomBytes(32).toString('hex');

    // Create share record
    const shareDoc = {
      token: tokenValue,
      resourceId: new ObjectId(resourceId),
      resourceName: resource.name,
      createdBy: {
        userId: user._id,
        username: user.username,
        email: user.email,
      },
      isPublic,
      allowedMembers,
      requirePassword: false,
      passwordHash: null,
      expiresAt: null,
      views: 0,
      downloads: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('shared_resources').insertOne(shareDoc);

    // Log activity
    try {
      await db.collection('doc_activity_logs').insertOne({
        projectId: resource.projectId,
        resourceId: resourceId,
        action: 'share_create',
        resourceType: 'file',
        resourceName: resource.name,
        userId: user._id,
        username: user.username,
        timestamp: new Date(),
        metadata: {
          shareToken: tokenValue,
          isPublic,
          allowedMembers,
        }
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }

    return NextResponse.json({
      _id: result.insertedId.toString(),
      token: tokenValue,
      shareUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/shared/${tokenValue}`,
      ...shareDoc,
    });

  } catch (error) {
    console.error('Share create error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
