import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../lib/dataroom/audit-logger';
import { validateFolderName, moveFolder, deleteFolder } from '../../../../../lib/dataroom/folder-utils';

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

// GET /api/dataroom/folders/[id] - Get single folder
export async function GET(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const folder = await db.collection('dataroom_folders').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    return NextResponse.json(folder);
  } catch (error) {
    console.error('GET /api/dataroom/folders/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/dataroom/folders/[id] - Rename or move folder
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, parentId, meta } = body;

    const client = await clientPromise;
    const db = client.db('resources');

    const folder = await db.collection('dataroom_folders').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const updates = { updatedAt: new Date() };
    let auditDetails = {};

    // Handle rename
    if (name && name !== folder.name) {
      const validation = validateFolderName(name);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // Update name and path
      const oldPath = folder.path;
      const pathParts = oldPath.split('/');
      pathParts[pathParts.length - 1] = validation.cleanName;
      const newPath = pathParts.join('/') || `/${validation.cleanName}`;

      // Check if new path exists
      const existing = await db.collection('dataroom_folders').findOne({
        roomId: folder.roomId,
        path: newPath,
        _id: { $ne: new ObjectId(id) },
      });

      if (existing) {
        return NextResponse.json({ error: 'A folder with this name already exists' }, { status: 409 });
      }

      updates.name = validation.cleanName;
      updates.path = newPath;
      auditDetails.renamed = { from: folder.name, to: validation.cleanName };

      // Update all descendant paths
      const descendants = await db.collection('dataroom_folders')
        .find({
          roomId: folder.roomId,
          path: { $regex: `^${escapeRegex(oldPath)}/` },
        })
        .toArray();

      for (const desc of descendants) {
        const updatedPath = desc.path.replace(oldPath, newPath);
        await db.collection('dataroom_folders').updateOne(
          { _id: desc._id },
          { $set: { path: updatedPath, updatedAt: new Date() } }
        );
      }
    }

    // Handle move (change parent)
    if (parentId !== undefined && parentId !== folder.parentId?.toString()) {
      const moveResult = await moveFolder(id, parentId, folder.roomId.toString());
      if (!moveResult.success) {
        return NextResponse.json({ error: moveResult.error }, { status: 400 });
      }
      auditDetails.moved = { newPath: moveResult.newPath };
    }

    // Handle metadata update
    if (meta) {
      updates.meta = { ...folder.meta, ...meta };
      auditDetails.metaUpdated = true;
    }

    await db.collection('dataroom_folders').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    await logAudit({
      action: AUDIT_ACTIONS.FOLDER_RENAME,
      resourceType: 'folder',
      resourceId: id,
      roomId: folder.roomId,
      user,
      details: auditDetails,
      request,
    });

    const updatedFolder = await db.collection('dataroom_folders').findOne({ _id: new ObjectId(id) });
    return NextResponse.json(updatedFolder);

  } catch (error) {
    console.error('PUT /api/dataroom/folders/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/dataroom/folders/[id] - Delete folder and contents
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    const client = await clientPromise;
    const db = client.db('resources');

    const folder = await db.collection('dataroom_folders').findOne({
      _id: new ObjectId(id),
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Prevent deleting root folder
    if (folder.path === '/') {
      return NextResponse.json({ error: 'Cannot delete root folder' }, { status: 400 });
    }

    const result = await deleteFolder(id, folder.roomId.toString(), permanent);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await logAudit({
      action: AUDIT_ACTIONS.FOLDER_DELETE,
      resourceType: 'folder',
      resourceId: id,
      roomId: folder.roomId,
      user,
      details: {
        path: folder.path,
        permanent,
        deletedFolders: result.deletedFolders,
        deletedDocuments: result.deletedDocuments,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      deletedFolders: result.deletedFolders,
      deletedDocuments: result.deletedDocuments,
    });

  } catch (error) {
    console.error('DELETE /api/dataroom/folders/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
