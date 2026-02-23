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

// POST /api/dataroom/documents/move - Move or copy documents between rooms/folders
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { documentIds, targetRoomId, targetFolderId, operation = 'move' } = body;

    // Validation
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'documentIds array is required' }, { status: 400 });
    }

    if (!targetRoomId || !ObjectId.isValid(targetRoomId)) {
      return NextResponse.json({ error: 'Valid targetRoomId is required' }, { status: 400 });
    }

    if (targetFolderId && !ObjectId.isValid(targetFolderId)) {
      return NextResponse.json({ error: 'Invalid targetFolderId' }, { status: 400 });
    }

    if (!['move', 'copy'].includes(operation)) {
      return NextResponse.json({ error: 'operation must be "move" or "copy"' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Verify target room exists
    const targetRoom = await db.collection('dataroom_rooms').findOne({
      _id: new ObjectId(targetRoomId),
      isDeleted: { $ne: true },
    });

    if (!targetRoom) {
      return NextResponse.json({ error: 'Target room not found' }, { status: 404 });
    }

    // Verify target folder if provided
    let targetFolderObjectId = null;
    if (targetFolderId && targetFolderId !== 'null') {
      const targetFolder = await db.collection('dataroom_folders').findOne({
        _id: new ObjectId(targetFolderId),
        roomId: new ObjectId(targetRoomId),
        isDeleted: { $ne: true },
      });

      if (!targetFolder) {
        return NextResponse.json({ error: 'Target folder not found' }, { status: 404 });
      }
      targetFolderObjectId = new ObjectId(targetFolderId);
    }

    const results = {
      total: documentIds.length,
      successful: [],
      failed: [],
    };

    for (const docId of documentIds) {
      try {
        if (!ObjectId.isValid(docId)) {
          results.failed.push({ documentId: docId, error: 'Invalid document ID' });
          continue;
        }

        const document = await db.collection('dataroom_documents').findOne({
          _id: new ObjectId(docId),
          isDeleted: { $ne: true },
        });

        if (!document) {
          results.failed.push({ documentId: docId, error: 'Document not found' });
          continue;
        }

        if (operation === 'move') {
          // MOVE: Update document location (no file duplication)
          await db.collection('dataroom_documents').updateOne(
            { _id: new ObjectId(docId) },
            {
              $set: {
                roomId: new ObjectId(targetRoomId),
                folderId: targetFolderObjectId,
                updatedAt: new Date(),
              },
            }
          );

          await logAudit({
            action: AUDIT_ACTIONS.DOCUMENT_MOVE,
            resourceType: 'document',
            resourceId: new ObjectId(docId),
            roomId: new ObjectId(targetRoomId),
            user,
            details: {
              name: document.name,
              fromRoomId: document.roomId.toString(),
              fromFolderId: document.folderId?.toString() || null,
              toRoomId: targetRoomId,
              toFolderId: targetFolderId || null,
            },
            request,
          });

          results.successful.push({ documentId: docId, operation: 'moved' });
        } else {
          // COPY: Create new document record but reference SAME fileId (no storage duplication)
          const newIndexNumber = await db.collection('dataroom_documents')
            .countDocuments({ roomId: new ObjectId(targetRoomId) }) + 1;

          const copiedDocument = {
            ...document,
            _id: new ObjectId(),
            roomId: new ObjectId(targetRoomId),
            folderId: targetFolderObjectId,
            indexNumber: newIndexNumber,
            name: `${document.name} (Copy)`,
            createdAt: new Date(),
            createdBy: {
              id: user._id.toString(),
              email: user.email,
              username: user.username,
            },
            updatedAt: new Date(),
            // IMPORTANT: Keep same fileId - no file duplication in GridFS
            fileId: document.fileId,
          };

          await db.collection('dataroom_documents').insertOne(copiedDocument);

          // Copy version records but keep same fileIds
          const versions = await db.collection('dataroom_versions').find({
            documentId: new ObjectId(docId),
          }).toArray();

          for (const version of versions) {
            await db.collection('dataroom_versions').insertOne({
              ...version,
              _id: new ObjectId(),
              documentId: copiedDocument._id,
              createdAt: new Date(),
              createdBy: {
                id: user._id.toString(),
                email: user.email,
                username: user.username,
              },
              // IMPORTANT: Keep same fileId - no file duplication
              fileId: version.fileId,
            });
          }

          await logAudit({
            action: AUDIT_ACTIONS.DOCUMENT_COPY,
            resourceType: 'document',
            resourceId: copiedDocument._id,
            roomId: new ObjectId(targetRoomId),
            user,
            details: {
              name: copiedDocument.name,
              originalDocumentId: docId,
              fromRoomId: document.roomId.toString(),
              toRoomId: targetRoomId,
              toFolderId: targetFolderId || null,
            },
            request,
          });

          results.successful.push({ 
            documentId: docId, 
            newDocumentId: copiedDocument._id.toString(), 
            operation: 'copied' 
          });
        }
      } catch (error) {
        console.error(`Error processing document ${docId}:`, error);
        results.failed.push({ documentId: docId, error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      operation,
      results,
    });

  } catch (error) {
    console.error('POST /api/dataroom/documents/move error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
