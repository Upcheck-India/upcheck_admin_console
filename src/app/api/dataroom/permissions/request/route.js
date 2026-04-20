import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../lib/dataroom/audit-logger';

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

// POST /api/dataroom/permissions/request - Request access to room/document
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { targetType, targetId, permissionLevel, reason } = body;

    // Validation
    if (!targetType || !['room', 'document', 'folder'].includes(targetType)) {
      return NextResponse.json({ error: 'Valid targetType required (room, document, folder)' }, { status: 400 });
    }

    if (!targetId || !ObjectId.isValid(targetId)) {
      return NextResponse.json({ error: 'Valid targetId required' }, { status: 400 });
    }

    if (!permissionLevel || !['view', 'comment', 'edit', 'download', 'print', 'admin'].includes(permissionLevel)) {
      return NextResponse.json({ error: 'Valid permissionLevel required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify target exists
    let targetName = '';
    if (targetType === 'room') {
      const room = await db.collection('dataroom_rooms').findOne({ 
        _id: new ObjectId(targetId),
        isDeleted: { $ne: true }
      });
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      targetName = room.name;
    } else if (targetType === 'document') {
      const doc = await db.collection('dataroom_documents').findOne({ 
        _id: new ObjectId(targetId),
        isDeleted: { $ne: true }
      });
      if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      targetName = doc.name;
    } else if (targetType === 'folder') {
      const folder = await db.collection('dataroom_folders').findOne({ 
        _id: new ObjectId(targetId),
        isDeleted: { $ne: true }
      });
      if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      targetName = folder.name;
    }

    // Check if request already exists
    const existingRequest = await db.collection('dataroom_access_requests').findOne({
      targetType,
      targetId: new ObjectId(targetId),
      requesterId: user._id,
      status: 'pending',
    });

    if (existingRequest) {
      return NextResponse.json({ error: 'You already have a pending request for this resource' }, { status: 409 });
    }

    // Check if user already has access
    const existingPermission = await db.collection('dataroom_permissions').findOne({
      targetType,
      targetId: new ObjectId(targetId),
      granteeType: 'user',
      granteeId: user._id.toString(),
      isRevoked: { $ne: true },
    });

    if (existingPermission) {
      return NextResponse.json({ error: 'You already have access to this resource' }, { status: 409 });
    }

    // Create access request
    const accessRequest = {
      targetType,
      targetId: new ObjectId(targetId),
      targetName,
      requesterId: user._id,
      requesterEmail: user.email,
      requesterName: user.username,
      permissionLevel,
      reason: reason || '',
      status: 'pending', // pending, approved, rejected
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('dataroom_access_requests').insertOne(accessRequest);

    await logAudit({
      action: AUDIT_ACTIONS.ACCESS_REQUESTED,
      resourceType: targetType,
      resourceId: new ObjectId(targetId),
      user,
      details: {
        targetName,
        permissionLevel,
        reason,
        requestId: result.insertedId,
      },
      request,
    });

    return NextResponse.json({
      message: 'Access request submitted successfully',
      request: {
        ...accessRequest,
        _id: result.insertedId,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/dataroom/permissions/request error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET /api/dataroom/permissions/request - List access requests
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, approved, rejected
    const myRequests = searchParams.get('myRequests') === 'true';

    const client = await clientPromise;
    const db = client.db('resources');

    const isAdmin = user.role === 'Admin' || user.role === 'Console admin';

    let filter = {};
    
    // Non-admins can only see their own requests
    if (!isAdmin || myRequests) {
      filter.requesterId = user._id;
    }

    if (status) {
      filter.status = status;
    }

    const requests = await db.collection('dataroom_access_requests')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      count: requests.length,
      requests,
    });

  } catch (error) {
    console.error('GET /api/dataroom/permissions/request error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
