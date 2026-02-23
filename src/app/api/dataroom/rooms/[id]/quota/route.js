import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

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

// GET /api/dataroom/rooms/[id]/quota - Get storage usage and quota for room
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify room exists
    const room = await db.collection('dataroom_rooms').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Calculate total storage used by room
    const documents = await db.collection('dataroom_documents').find({
      roomId: new ObjectId(id),
      isDeleted: { $ne: true },
    }).toArray();

    const totalFileSize = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
    const documentCount = documents.length;

    // Get version files (not counted in main documents)
    const versions = await db.collection('dataroom_versions').find({
      documentId: { $in: documents.map(d => d._id) },
    }).toArray();

    const versionFileSize = versions.reduce((sum, v) => sum + (v.fileSize || 0), 0);

    // Room quota (configurable per room, default 10GB)
    const quotaLimit = room.storageQuota || 10 * 1024 * 1024 * 1024; // 10GB default
    const totalUsed = totalFileSize + versionFileSize;
    const percentUsed = (totalUsed / quotaLimit) * 100;
    const remaining = quotaLimit - totalUsed;

    // Get folder breakdown
    const folderStats = await db.collection('dataroom_documents').aggregate([
      {
        $match: {
          roomId: new ObjectId(id),
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: '$folderId',
          count: { $sum: 1 },
          totalSize: { $sum: '$fileSize' },
        },
      },
    ]).toArray();

    // Get top 10 largest documents
    const largestDocuments = await db.collection('dataroom_documents').find({
      roomId: new ObjectId(id),
      isDeleted: { $ne: true },
    })
      .sort({ fileSize: -1 })
      .limit(10)
      .project({ _id: 1, name: 1, fileSize: 1, fileName: 1, createdAt: 1 })
      .toArray();

    return NextResponse.json({
      roomId: id,
      roomName: room.name,
      quota: {
        limit: quotaLimit,
        used: totalUsed,
        remaining,
        percentUsed: Math.min(percentUsed, 100),
        isOverQuota: totalUsed > quotaLimit,
      },
      breakdown: {
        documents: {
          count: documentCount,
          size: totalFileSize,
        },
        versions: {
          count: versions.length,
          size: versionFileSize,
        },
      },
      folderStats,
      largestDocuments,
      updatedAt: new Date(),
    });

  } catch (error) {
    console.error('GET /api/dataroom/rooms/[id]/quota error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/dataroom/rooms/[id]/quota - Update room storage quota (admin only)
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'Admin' && user.role !== 'Console admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
    }

    const body = await request.json();
    const { quotaLimit } = body; // in bytes

    if (typeof quotaLimit !== 'number' || quotaLimit <= 0) {
      return NextResponse.json({ error: 'Valid quotaLimit (in bytes) is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const room = await db.collection('dataroom_rooms').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    await db.collection('dataroom_rooms').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          storageQuota: quotaLimit,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      roomId: id,
      newQuota: quotaLimit,
      quotaGB: quotaLimit / (1024 * 1024 * 1024),
    });

  } catch (error) {
    console.error('PUT /api/dataroom/rooms/[id]/quota error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
