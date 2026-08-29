import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../lib/dataroom/audit-logger';
import { validateFolderName, moveFolder, deleteFolder } from '../../../../../lib/dataroom/folder-utils';
import { withDataroomAuth } from '../../../../../lib/dataroom/withDataroomAuth';

// GET /api/dataroom/folders/[id] - Get single folder
export const GET = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
    }

    const folder = await db.collection('dataroom_folders').findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    return NextResponse.json(folder);
  },
  {
    requires: 'view',
    resource: { type: 'folder', param: 'id' },
  },
);

// PUT /api/dataroom/folders/[id] - Rename or move folder
export const PUT = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, parentId, meta } = body;

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
  },
  {
    requires: 'edit',
    resource: { type: 'folder', param: 'id' },
  },
);

// DELETE /api/dataroom/folders/[id] - Delete folder and contents
export const DELETE = withDataroomAuth(
  async (request, { user, db, params }) => {

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

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
  },
  {
    requires: 'edit',
    resource: { type: 'folder', param: 'id' },
  },
);

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
