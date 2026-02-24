import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

async function getUserFromToken(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, username: 1, role: 1 } }
    );
    return user;
  } catch {
    return null;
  }
}

function isAdminLike(user) {
  return user && (user.role === 'Admin' || user.role === 'Console admin');
}

// GET /api/dataroom/share - List shares for a resource
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');

    if (!resourceType || !resourceId || !ObjectId.isValid(resourceId)) {
      return NextResponse.json({ error: 'Valid resourceType and resourceId required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const shares = await db.collection('dataroom_shares')
      .find({
        resourceType,
        resourceId: new ObjectId(resourceId),
      })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ shares });

  } catch (error) {
    console.error('GET /api/dataroom/share error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/dataroom/share - Create a new share link
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { resourceType, resourceId, roomId, targetEmail, permissions, expiresAt } = body;

    if (!resourceType || !resourceId || !ObjectId.isValid(resourceId)) {
      return NextResponse.json({ error: 'Valid resourceType and resourceId required' }, { status: 400 });
    }

    if (!targetEmail || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ error: 'targetEmail and permissions required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Generate unique share token
    const shareToken = crypto.randomBytes(32).toString('hex');

    // Create share record
    const shareDoc = {
      shareToken,
      resourceType,
      resourceId: new ObjectId(resourceId),
      roomId: roomId ? new ObjectId(roomId) : null,
      targetEmail: targetEmail.toLowerCase(),
      permissions,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
      createdAt: new Date(),
      revokedAt: null,
      accessCount: 0,
      lastAccessedAt: null,
    };

    const result = await db.collection('dataroom_shares').insertOne(shareDoc);

    // Log audit event
    await db.collection('dataroom_audit_log').insertOne({
      userId: user._id.toString(),
      userEmail: user.email,
      action: 'share_created',
      resourceType,
      resourceId: new ObjectId(resourceId),
      details: {
        targetEmail,
        permissions,
        shareToken,
        expiresAt,
      },
      timestamp: new Date(),
    });

    // TODO: Send email invitation with share link
    // For now, return the share token so it can be copied

    return NextResponse.json({
      success: true,
      shareId: result.insertedId,
      shareToken,
      message: 'Share link created successfully',
    });

  } catch (error) {
    console.error('POST /api/dataroom/share error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
