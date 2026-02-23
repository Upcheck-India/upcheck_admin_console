import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { GridFSBucket, ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';
import { checkPermission } from '../../../../../../lib/dataroom/permission-checker';
import { validateIpWhitelist, isRoomExpired, getClientIp } from '../../../../../../lib/dataroom/security';

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

// GET /api/dataroom/documents/[id]/download - Download document file
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Get document metadata
    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!document.fileId) {
      return NextResponse.json({ error: 'No file associated with this document' }, { status: 404 });
    }

    // Get room and perform security checks
    const room = await db.collection('dataroom_rooms').findOne({
      _id: document.roomId,
      isDeleted: { $ne: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // SECURITY: Check if room has expired
    if (isRoomExpired(room)) {
      return NextResponse.json({ error: 'This room has expired' }, { status: 403 });
    }

    // SECURITY: Check IP whitelist
    const clientIp = getClientIp(request);
    if (!validateIpWhitelist(clientIp, room.ipWhitelist)) {
      await logAudit({
        action: 'IP_WHITELIST_VIOLATION',
        resourceType: 'document',
        resourceId: id,
        roomId: document.roomId,
        user,
        details: { clientIp, deniedAccess: true },
        request,
      });
      return NextResponse.json({ error: 'Access denied: IP not whitelisted' }, { status: 403 });
    }

    // SECURITY: Check granular permissions
    const hasDownloadPermission = await checkPermission({
      user,
      permission: 'download',
      resourceType: 'document',
      resourceId: id,
      roomId: room._id.toString(),
    });

    if (!hasDownloadPermission && user.role !== 'Admin' && user.role !== 'Console admin') {
      return NextResponse.json({ error: 'You do not have download permission for this document' }, { status: 403 });
    }

    // Check room settings for download permission
    if (room.settings && room.settings.allowDownload === false) {
      // Check if user is admin (admins can always download)
      if (user.role !== 'Admin' && user.role !== 'Console admin') {
        return NextResponse.json({ error: 'Downloads are disabled for this room' }, { status: 403 });
      }
    }

    // Get file from GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'dataroom_files' });

    // Find the file
    const files = await bucket.find({ _id: document.fileId }).toArray();
    if (files.length === 0) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

    const file = files[0];

    // Create download stream
    const downloadStream = bucket.openDownloadStream(document.fileId);

    // Collect chunks
    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Log download
    await logAudit({
      action: AUDIT_ACTIONS.DOCUMENT_DOWNLOAD,
      resourceType: 'document',
      resourceId: id,
      roomId: document.roomId,
      user,
      details: {
        name: document.name,
        fileName: document.fileName,
        fileSize: document.fileSize,
      },
      request,
    });

    // Update analytics
    await db.collection('dataroom_analytics').updateOne(
      { documentId: new ObjectId(id), date: new Date().toISOString().split('T')[0] },
      {
        $inc: { downloadCount: 1 },
        $push: {
          downloads: {
            userId: user._id.toString(),
            userEmail: user.email,
            timestamp: new Date(),
          },
        },
      },
      { upsert: true }
    );

    // Return file
    const headers = new Headers();
    headers.set('Content-Type', file.contentType || document.mimeType || 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(document.fileName || file.filename)}"`);
    headers.set('Content-Length', buffer.length.toString());

    return new NextResponse(buffer, { headers });

  } catch (error) {
    console.error('GET /api/dataroom/documents/[id]/download error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
