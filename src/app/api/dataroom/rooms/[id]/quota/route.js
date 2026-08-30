import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { withDataroomAuth } from '../../../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/rooms/[id]/quota - Get storage usage and quota for room
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
    }

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
  },
  {
    requires: 'view',
    resource: { type: 'room', param: 'id' },
  },
);

// PUT /api/dataroom/rooms/[id]/quota - Update room storage quota (admin only)
export const PUT = withDataroomAuth(
  async (request, { user, db, params }) => {
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
  },
  {
    requires: 'admin',
    resource: { type: 'room', param: 'id' },
  },
);
