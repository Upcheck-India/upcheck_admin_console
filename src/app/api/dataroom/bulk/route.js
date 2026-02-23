import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit } from '../../../../lib/dataroom/audit-logger';
import { deleteFolder } from '../../../../lib/dataroom/folder-utils';

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

// POST /api/dataroom/bulk - Bulk operations
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { operation, resourceType, resourceIds, targetFolderId, roomId } = body;

    if (!operation || !['delete', 'move', 'copy'].includes(operation)) {
      return NextResponse.json({ error: 'Valid operation is required (delete, move, copy)' }, { status: 400 });
    }

    if (!resourceType || !['document', 'folder'].includes(resourceType)) {
      return NextResponse.json({ error: 'Valid resourceType is required (document, folder)' }, { status: 400 });
    }

    if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
      return NextResponse.json({ error: 'resourceIds array is required' }, { status: 400 });
    }

    // Limit bulk operations to prevent abuse
    if (resourceIds.length > 100) {
      return NextResponse.json({ error: 'Cannot perform bulk operation on more than 100 items at once' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    if (operation === 'delete') {
      // Bulk delete
      for (const id of resourceIds) {
        if (!ObjectId.isValid(id)) {
          results.failed++;
          results.errors.push({ id, error: 'Invalid ID' });
          continue;
        }

        try {
          if (resourceType === 'document') {
            await db.collection('dataroom_documents').updateOne(
              { _id: new ObjectId(id) },
              {
                $set: {
                  isDeleted: true,
                  deletedAt: new Date(),
                  deletedBy: user._id.toString(),
                },
              }
            );
            results.success++;
          } else if (resourceType === 'folder') {
            const folder = await db.collection('dataroom_folders').findOne({ _id: new ObjectId(id) });
            if (folder) {
              await deleteFolder(id, folder.roomId.toString(), false);
              results.success++;
            } else {
              results.failed++;
              results.errors.push({ id, error: 'Folder not found' });
            }
          }
        } catch (error) {
          results.failed++;
          results.errors.push({ id, error: error.message });
        }
      }
    } else if (operation === 'move') {
      // Bulk move
      if (!targetFolderId) {
        return NextResponse.json({ error: 'targetFolderId is required for move operation' }, { status: 400 });
      }

      if (!ObjectId.isValid(targetFolderId)) {
        return NextResponse.json({ error: 'Invalid targetFolderId' }, { status: 400 });
      }

      for (const id of resourceIds) {
        if (!ObjectId.isValid(id)) {
          results.failed++;
          results.errors.push({ id, error: 'Invalid ID' });
          continue;
        }

        try {
          if (resourceType === 'document') {
            const doc = await db.collection('dataroom_documents').findOne({ _id: new ObjectId(id) });
            if (doc) {
              await db.collection('dataroom_documents').updateOne(
                { _id: new ObjectId(id) },
                {
                  $set: {
                    folderId: new ObjectId(targetFolderId),
                    updatedAt: new Date(),
                  },
                }
              );
              results.success++;
            } else {
              results.failed++;
              results.errors.push({ id, error: 'Document not found' });
            }
          } else if (resourceType === 'folder') {
            // Folder move is more complex - use moveFolder utility
            results.failed++;
            results.errors.push({ id, error: 'Bulk folder move not yet implemented' });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({ id, error: error.message });
        }
      }
    } else if (operation === 'copy') {
      // Bulk copy (create duplicates)
      for (const id of resourceIds) {
        if (!ObjectId.isValid(id)) {
          results.failed++;
          results.errors.push({ id, error: 'Invalid ID' });
          continue;
        }

        try {
          if (resourceType === 'document') {
            const original = await db.collection('dataroom_documents').findOne({ _id: new ObjectId(id) });
            if (original) {
              const copy = {
                ...original,
                _id: undefined,
                name: `${original.name} (Copy)`,
                createdAt: new Date(),
                createdBy: {
                  id: user._id.toString(),
                  email: user.email,
                  username: user.username,
                },
                updatedAt: new Date(),
              };
              await db.collection('dataroom_documents').insertOne(copy);
              results.success++;
            } else {
              results.failed++;
              results.errors.push({ id, error: 'Document not found' });
            }
          } else {
            results.failed++;
            results.errors.push({ id, error: 'Folder copy not yet implemented' });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({ id, error: error.message });
        }
      }
    }

    await logAudit({
      action: `BULK_${operation.toUpperCase()}`,
      resourceType: 'bulk_operation',
      resourceId: null,
      roomId: roomId ? new ObjectId(roomId) : null,
      user,
      details: {
        operation,
        resourceType,
        totalCount: resourceIds.length,
        successCount: results.success,
        failedCount: results.failed,
      },
      request,
    });

    return NextResponse.json({
      operation,
      resourceType,
      total: resourceIds.length,
      ...results,
    });

  } catch (error) {
    console.error('POST /api/dataroom/bulk error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
