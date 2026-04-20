import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit } from '../../../../lib/dataroom/audit-logger';
import { generateSecureToken } from '../../../../lib/dataroom/security';

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

// GET /api/dataroom/external-users - List external users
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const status = searchParams.get('status');

    const client = await clientPromise;
    const db = client.db('resources');

    const filter = { isDeleted: { $ne: true } };
    
    if (roomId && ObjectId.isValid(roomId)) {
      filter.roomId = new ObjectId(roomId);
    }
    
    if (status && ['invited', 'active', 'revoked'].includes(status)) {
      filter.status = status;
    }

    const externalUsers = await db.collection('dataroom_external_users')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ count: externalUsers.length, items: externalUsers });
  } catch (error) {
    console.error('GET /api/dataroom/external-users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/dataroom/external-users - Invite external user
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const {
      email,
      name,
      organization,
      roomId,
      role = 'viewer',
      expiresAt = null,
      sendInviteEmail = true,
    } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (!roomId || !ObjectId.isValid(roomId)) {
      return NextResponse.json({ error: 'Valid roomId is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify room exists
    const room = await db.collection('dataroom_rooms').findOne({
      _id: new ObjectId(roomId),
      isDeleted: { $ne: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Check if user already invited
    const existing = await db.collection('dataroom_external_users').findOne({
      email: email.toLowerCase().trim(),
      roomId: new ObjectId(roomId),
      status: { $in: ['invited', 'active'] },
    });

    if (existing) {
      return NextResponse.json({ error: 'User already has access to this room' }, { status: 409 });
    }

    const accessToken = generateSecureToken();
    const inviteToken = generateSecureToken();

    const newExternalUser = {
      email: email.toLowerCase().trim(),
      name: name?.trim() || null,
      organization: organization?.trim() || null,
      roomId: new ObjectId(roomId),
      role, // viewer, contributor, etc.
      status: 'invited',
      accessToken, // For API access if needed
      inviteToken, // One-time token for registration
      inviteUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dataroom/external/register?token=${inviteToken}`,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      invitedAt: new Date(),
      invitedBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
      lastAccessAt: null,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('dataroom_external_users').insertOne(newExternalUser);

    await logAudit({
      action: 'EXTERNAL_USER_INVITE',
      resourceType: 'external_user',
      resourceId: result.insertedId,
      roomId: new ObjectId(roomId),
      user,
      details: {
        email: newExternalUser.email,
        name: newExternalUser.name,
        organization: newExternalUser.organization,
      },
      request,
    });

    // Send invite email if requested (integrate with existing email system later)
    if (sendInviteEmail) {
      console.log('Email invite would be sent to:', newExternalUser.email, 'URL:', newExternalUser.inviteUrl);
    }

    return NextResponse.json({ 
      ...newExternalUser, 
      _id: result.insertedId,
      // Don't expose tokens in response except inviteUrl for UI display
      accessToken: undefined,
      inviteToken: undefined,
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/dataroom/external-users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
