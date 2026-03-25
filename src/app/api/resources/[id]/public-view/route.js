// src/app/api/resources/[id]/public-view/route.js
// Creates a temporary public URL for external viewers (Office Online, Google Docs)
import { NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// GET - Generate a temporary public view URL
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify user
    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the resource
    const resource = await db.collection('resources').findOne({
      _id: new ObjectId(id)
    });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Check project access
    if (resource.projectId && resource.projectId !== 'general') {
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(resource.projectId)
      });

      if (project) {
        const isMember = project.members?.some(m => m.user === user.username);
        const isSuperManager = project.superManager === user.username;
        const isAdmin = user.role === 'Admin' || user.role === 'Console admin';

        if (!isMember && !isSuperManager && !isAdmin) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    // Generate a temporary token (valid for 1 hour)
    const expiresIn = 3600; // 1 hour in seconds
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    const tokenData = `${resource._id.toString()}-${expiresAt}-${user._id.toString()}`;
    const secret = process.env.NEXT_PUBLIC_APP_URL || 'default-secret-change-me';
    const signature = crypto.createHmac('sha256', secret).update(tokenData).digest('hex');
    const publicToken = `${Buffer.from(JSON.stringify({
      resourceId: resource._id.toString(),
      expiresAt,
      userId: user._id.toString()
    })).toString('base64')}.${signature}`;

    // Store the token in a temporary tokens collection
    await db.collection('temporary_access_tokens').insertOne({
      token: publicToken,
      resourceId: resource._id,
      userId: user._id,
      expiresAt: new Date(expiresAt * 1000),
      createdAt: new Date(),
      purpose: 'external_viewer'
    });

    // Clean up expired tokens
    await db.collection('temporary_access_tokens').deleteMany({
      expiresAt: { $lt: new Date() }
    });

    // Generate the public URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin');
    const publicUrl = `${baseUrl}/api/resources/${id}/public-view/${publicToken}`;

    return NextResponse.json({
      success: true,
      publicUrl,
      expiresAt: new Date(expiresAt * 1000),
      expiresIn
    });
  } catch (error) {
    console.error('Error generating public view URL:', error);
    return NextResponse.json({ error: 'Failed to generate public view URL' }, { status: 500 });
  }
}
