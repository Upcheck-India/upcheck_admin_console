import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { GridFSBucket, ObjectId } from 'mongodb';
import { hasPermission } from '../../../../../../lib/dataroom/permission-checker';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../lib/dataroom/audit-logger';

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

// GET /api/dataroom/documents/[id]/view - Stream document securely for viewing
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const chunk = searchParams.get('chunk'); // For chunk-based streaming

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Get document
    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check view permission
    const canView = await hasPermission({
      user,
      resourceType: 'document',
      resourceId: id,
      permission: 'view',
      roomId: document.roomId,
    });

    if (!canView) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get room settings
    const room = await db.collection('dataroom_rooms').findOne({
      _id: document.roomId,
    });

    // Track view
    await db.collection('dataroom_documents').updateOne(
      { _id: new ObjectId(id) },
      { 
        $inc: { viewCount: 1 },
        $set: { lastViewedAt: new Date() }
      }
    );

    // Update analytics
    await db.collection('dataroom_analytics').updateOne(
      { documentId: new ObjectId(id), userId: user._id },
      {
        $set: {
          documentId: new ObjectId(id),
          roomId: document.roomId,
          userId: user._id,
          userEmail: user.email,
          lastViewedAt: new Date(),
        },
        $inc: { viewCount: 1 },
        $setOnInsert: {
          firstViewedAt: new Date(),
          downloadCount: 0,
          printCount: 0,
        },
      },
      { upsert: true }
    );

    // Audit log
    await logAudit({
      action: AUDIT_ACTIONS.DOCUMENT_VIEWED,
      resourceType: 'document',
      resourceId: new ObjectId(id),
      roomId: document.roomId,
      user,
      details: {
        documentName: document.name,
        fileName: document.fileName,
      },
      request,
    });

    // Stream file from GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'dataroom_files' });
    
    try {
      const downloadStream = bucket.openDownloadStream(document.fileId);
      
      // For chunk-based streaming (security feature)
      if (chunk) {
        const chunkSize = 1024 * 1024; // 1MB chunks
        const chunkNumber = parseInt(chunk);
        const skipBytes = chunkNumber * chunkSize;
        
        const chunks = [];
        let bytesRead = 0;
        let bytesSkipped = 0;

        for await (const data of downloadStream) {
          if (bytesSkipped < skipBytes) {
            bytesSkipped += data.length;
            continue;
          }
          
          chunks.push(data);
          bytesRead += data.length;
          
          if (bytesRead >= chunkSize) {
            break;
          }
        }
        
        const chunkBuffer = Buffer.concat(chunks);
        
        return new NextResponse(chunkBuffer, {
          headers: {
            'Content-Type': document.mimeType || 'application/octet-stream',
            'Content-Length': chunkBuffer.length.toString(),
            'X-Chunk-Number': chunk,
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        });
      }

      // Full file streaming (with caching disabled for security)
      const chunks = [];
      for await (const chunk of downloadStream) {
        chunks.push(chunk);
      }
      
      const fileBuffer = Buffer.concat(chunks);
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': document.mimeType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${document.fileName}"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN',
        },
      });

    } catch (gridfsError) {
      console.error('GridFS streaming error:', gridfsError);
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

  } catch (error) {
    console.error('GET /api/dataroom/documents/[id]/view error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
