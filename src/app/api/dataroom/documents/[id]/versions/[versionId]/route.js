import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../../lib/mongodb';
import { GridFSBucket, ObjectId } from 'mongodb';

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

// GET /api/dataroom/documents/[id]/versions/[versionId] - Get specific version
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, versionId } = await params;

    if (!ObjectId.isValid(id) || !ObjectId.isValid(versionId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Get the document
    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get the specific version
    const version = await db.collection('dataroom_versions').findOne({
      _id: new ObjectId(versionId),
      documentId: new ObjectId(id),
    });

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Get file from GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'dataroom_files' });
    
    try {
      const downloadStream = bucket.openDownloadStream(version.fileId);
      const chunks = [];
      
      for await (const chunk of downloadStream) {
        chunks.push(chunk);
      }
      
      const fileBuffer = Buffer.concat(chunks);
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': version.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${version.fileName}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    } catch (gridfsError) {
      console.error('GridFS download error:', gridfsError);
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

  } catch (error) {
    console.error('GET /api/dataroom/documents/[id]/versions/[versionId] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
