import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../../../../lib/dataroom/audit-logger';

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

// POST /api/dataroom/documents/[id]/versions/[versionId]/restore - Restore to specific version
export async function POST(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, versionId } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }
    if (!ObjectId.isValid(versionId)) {
      return NextResponse.json({ error: 'Invalid version ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify document exists
    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if document is locked by another user
    if (document.isLocked && document.lockedBy !== user._id.toString()) {
      return NextResponse.json({ error: 'Document is locked by another user' }, { status: 423 });
    }

    // Find the version to restore
    const version = await db.collection('dataroom_versions').findOne({
      _id: new ObjectId(versionId),
      documentId: new ObjectId(id),
    });

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Calculate new version number (restore creates a new version)
    const currentVersion = document.currentVersion || 1;
    const newVersion = Math.floor(currentVersion) + 1;

    // Create a new version record for the restore
    const restoredVersion = {
      documentId: new ObjectId(id),
      versionNumber: newVersion,
      fileId: version.fileId,
      fileName: version.fileName,
      fileSize: version.fileSize,
      mimeType: version.mimeType,
      changeNote: `Restored from version ${version.versionNumber}`,
      restoredFrom: version.versionNumber,
      createdAt: new Date(),
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
    };

    await db.collection('dataroom_versions').insertOne(restoredVersion);

    // Update document to point to the restored version's file
    await db.collection('dataroom_documents').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          currentVersion: newVersion,
          fileId: version.fileId,
          fileName: version.fileName,
          fileSize: version.fileSize,
          mimeType: version.mimeType,
          updatedAt: new Date(),
        },
      }
    );

    await logAudit({
      action: AUDIT_ACTIONS.VERSION_RESTORE,
      resourceType: 'document',
      resourceId: id,
      roomId: document.roomId,
      user,
      details: {
        restoredFromVersion: version.versionNumber,
        newVersion,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      restoredFromVersion: version.versionNumber,
      newVersion,
      document: {
        _id: id,
        currentVersion: newVersion,
        fileId: version.fileId,
        fileName: version.fileName,
      },
    });

  } catch (error) {
    console.error('POST /api/dataroom/documents/[id]/versions/[versionId]/restore error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
