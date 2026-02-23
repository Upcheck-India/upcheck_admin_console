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

function isAdminLike(user) {
  return user && (user.role === 'Admin' || user.role === 'Console admin');
}

function isValidIP(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => parseInt(part) >= 0 && parseInt(part) <= 255);
  }
  
  return ipv6Regex.test(ip);
}

// POST /api/dataroom/permissions/ip-whitelist - Configure IP whitelist for room/user
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user || !isAdminLike(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { targetType, targetId, ipAddresses, enabled = true } = body;

    // Validation
    if (!targetType || !['room', 'user', 'external_user'].includes(targetType)) {
      return NextResponse.json({ error: 'Valid targetType required (room, user, external_user)' }, { status: 400 });
    }

    if (!targetId || !ObjectId.isValid(targetId)) {
      return NextResponse.json({ error: 'Valid targetId required' }, { status: 400 });
    }

    if (!Array.isArray(ipAddresses) || ipAddresses.length === 0) {
      return NextResponse.json({ error: 'ipAddresses array is required' }, { status: 400 });
    }

    // Validate all IP addresses
    const invalidIPs = ipAddresses.filter(ip => !isValidIP(ip));
    if (invalidIPs.length > 0) {
      return NextResponse.json({ 
        error: 'Invalid IP addresses', 
        invalidIPs 
      }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify target exists
    let targetExists = false;
    if (targetType === 'room') {
      targetExists = await db.collection('dataroom_rooms').countDocuments({ 
        _id: new ObjectId(targetId),
        isDeleted: { $ne: true }
      }) > 0;
    } else if (targetType === 'user') {
      targetExists = await db.collection('admin_users').countDocuments({ 
        _id: new ObjectId(targetId)
      }) > 0;
    } else if (targetType === 'external_user') {
      targetExists = await db.collection('dataroom_external_users').countDocuments({ 
        _id: new ObjectId(targetId),
        status: 'active'
      }) > 0;
    }

    if (!targetExists) {
      return NextResponse.json({ error: `${targetType} not found` }, { status: 404 });
    }

    // Create or update IP whitelist config
    const config = {
      targetType,
      targetId: new ObjectId(targetId),
      ipAddresses: [...new Set(ipAddresses)], // Remove duplicates
      enabled,
      createdAt: new Date(),
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
      updatedAt: new Date(),
    };

    const result = await db.collection('dataroom_ip_whitelist').updateOne(
      { targetType, targetId: new ObjectId(targetId) },
      { 
        $set: config,
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    await logAudit({
      action: AUDIT_ACTIONS.IP_WHITELIST_CONFIGURED,
      resourceType: 'ip_whitelist',
      resourceId: result.upsertedId || new ObjectId(targetId),
      user,
      details: {
        targetType,
        targetId,
        ipCount: ipAddresses.length,
        enabled,
      },
      request,
    });

    return NextResponse.json({
      message: 'IP whitelist configured successfully',
      config: {
        ...config,
        _id: result.upsertedId || targetId,
      },
    }, { status: result.upsertedId ? 201 : 200 });

  } catch (error) {
    console.error('POST /api/dataroom/permissions/ip-whitelist error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET /api/dataroom/permissions/ip-whitelist?targetType=room&targetId=xxx
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('targetType');
    const targetId = searchParams.get('targetId');

    if (!targetType || !targetId || !ObjectId.isValid(targetId)) {
      return NextResponse.json({ error: 'Valid targetType and targetId required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const config = await db.collection('dataroom_ip_whitelist').findOne({
      targetType,
      targetId: new ObjectId(targetId),
    });

    if (!config) {
      return NextResponse.json({ 
        exists: false,
        enabled: false,
        ipAddresses: [] 
      });
    }

    return NextResponse.json({
      exists: true,
      ...config,
    });

  } catch (error) {
    console.error('GET /api/dataroom/permissions/ip-whitelist error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
