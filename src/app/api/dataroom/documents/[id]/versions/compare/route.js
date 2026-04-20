import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../../lib/mongodb';
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

// GET /api/dataroom/documents/[id]/versions/compare?v1={versionId1}&v2={versionId2}
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const v1 = searchParams.get('v1');
    const v2 = searchParams.get('v2');

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    if (!v1 || !v2 || !ObjectId.isValid(v1) || !ObjectId.isValid(v2)) {
      return NextResponse.json({ error: 'Valid version IDs (v1, v2) are required' }, { status: 400 });
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

    // Get both versions
    const versions = await db.collection('dataroom_versions').find({
      _id: { $in: [new ObjectId(v1), new ObjectId(v2)] },
      documentId: new ObjectId(id),
    }).toArray();

    if (versions.length !== 2) {
      return NextResponse.json({ error: 'One or both versions not found' }, { status: 404 });
    }

    const version1 = versions.find(v => v._id.toString() === v1);
    const version2 = versions.find(v => v._id.toString() === v2);

    // Calculate differences
    const differences = {
      fileName: version1.fileName !== version2.fileName,
      fileSize: version1.fileSize !== version2.fileSize,
      mimeType: version1.mimeType !== version2.mimeType,
      creator: version1.createdBy?.id !== version2.createdBy?.id,
    };

    const sizeDifference = version2.fileSize - version1.fileSize;
    const timeDifference = new Date(version2.createdAt) - new Date(version1.createdAt);

    return NextResponse.json({
      document: {
        id: document._id,
        name: document.name,
      },
      version1: {
        ...version1,
        versionLabel: `v${version1.versionNumber}`,
      },
      version2: {
        ...version2,
        versionLabel: `v${version2.versionNumber}`,
      },
      comparison: {
        differences,
        hasDifferences: Object.values(differences).some(d => d),
        sizeDifference,
        sizeDifferenceFormatted: `${sizeDifference > 0 ? '+' : ''}${(sizeDifference / 1024).toFixed(2)} KB`,
        timeDifference,
        timeDifferenceFormatted: `${Math.floor(timeDifference / (1000 * 60 * 60 * 24))} days`,
        olderVersion: version1.versionNumber < version2.versionNumber ? 'v1' : 'v2',
        newerVersion: version1.versionNumber > version2.versionNumber ? 'v1' : 'v2',
      },
    });

  } catch (error) {
    console.error('GET /api/dataroom/documents/[id]/versions/compare error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
