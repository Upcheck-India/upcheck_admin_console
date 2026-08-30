import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../lib/dataroom/audit-logger';
import { validateFolderName, generateFolderPath } from '../../../../lib/dataroom/folder-utils';
import { withDataroomAuth } from '../../../../lib/dataroom/withDataroomAuth';
import { shareFoldersFilter } from '../../../../lib/dataroom/share-links';

export const GET = withDataroomAuth(
  async (request, { user, db, params, share }) => {

    const { searchParams } = new URL(request.url);
    const roomIdParam = searchParams.get('roomId');
    const parentIdParam = searchParams.get('parentId');

    const filter = {};
    if (roomIdParam) {
      if (!ObjectId.isValid(roomIdParam)) {
        return NextResponse.json({ error: 'Invalid roomId' }, { status: 400 });
      }
      filter.roomId = new ObjectId(roomIdParam);
    }

    // Filter by parentId to show only folders at the requested level
    if (parentIdParam && parentIdParam !== 'null') {
      if (!ObjectId.isValid(parentIdParam)) {
        return NextResponse.json({ error: 'Invalid parentId' }, { status: 400 });
      }
      filter.parentId = new ObjectId(parentIdParam);
    } else if (parentIdParam === 'null' || parentIdParam === null) {
      // Explicitly requesting root-level folders
      filter.parentId = null;
    }

    // A share-link visitor sees the shared folder and its descendants, or the
    // whole tree for a room link. A document link grants nothing here.
    const scopedFilter = share
      ? { $and: [filter, await shareFoldersFilter(db, share)] }
      : filter;

    const folders = await db.collection('dataroom_folders').find(scopedFilter).limit(200).toArray();

    // Add document counts to each folder
    const folderIds = folders.map(f => f._id);
    const documentCounts = await db.collection('dataroom_documents').aggregate([
      {
        $match: {
          folderId: { $in: folderIds },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$folderId',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    // Create a map for quick lookup
    const countMap = {};
    documentCounts.forEach(item => {
      countMap[item._id.toString()] = item.count;
    });

    // Attach counts to folders
    const foldersWithCounts = folders.map(folder => ({
      ...folder,
      documentCount: countMap[folder._id.toString()] || 0
    }));

    return NextResponse.json({ count: foldersWithCounts.length, items: foldersWithCounts });
  },
  {
    requires: 'view',
    resource: { type: 'room', query: 'roomId' },
    allowExternal: true,
    allowShare: true,
    shareScoped: true,
  },
);

export const POST = withDataroomAuth(
  async (request, { user, db, params }) => {

    const body = await request.json();
    const { roomId, name, parentId } = body;

    if (!roomId || !ObjectId.isValid(roomId)) {
      return NextResponse.json({ error: 'Folder creation is only allowed within a valid Data Room. Global folders are not permitted.' }, { status: 400 });
    }

    const validation = validateFolderName(name);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const cleanName = validation.cleanName;
    const foldersColl = db.collection('dataroom_folders');
    const targetRoomId = new ObjectId(roomId);

    let path;
    let targetParentId = null;

    if (parentId) {
      if (!ObjectId.isValid(parentId)) {
        return NextResponse.json({ error: 'Invalid parentId' }, { status: 400 });
      }
      targetParentId = new ObjectId(parentId);

      const parentFolder = await foldersColl.findOne({ _id: targetParentId, roomId: targetRoomId });
      if (!parentFolder) {
        return NextResponse.json({ error: 'Parent folder not found in this room' }, { status: 404 });
      }

      path = generateFolderPath(parentFolder.path, cleanName);
    } else {
      path = `/${cleanName}`;
    }

    const existing = await foldersColl.findOne({ roomId: targetRoomId, path });
    if (existing) {
      return NextResponse.json({ error: 'A folder with this name already exists at this location' }, { status: 409 });
    }

    const newFolder = {
      roomId: targetRoomId,
      name: cleanName,
      path,
      parentId: targetParentId,
      createdAt: new Date(),
      createdBy: {
        id: user._id.toString(),
        email: user.email,
        username: user.username
      },
      meta: {},
      isDeleted: false,
    };

    const result = await foldersColl.insertOne(newFolder);

    // Auto-grant the creator 'admin' access to the folder
    await db.collection('dataroom_permissions').insertOne({
      resourceType: 'folder',
      resourceId: result.insertedId.toString(),
      roomId: roomId.toString(),
      userId: user._id.toString(),
      userEmail: user.email,
      groupId: null,
      permissions: ['admin'],
      expiresAt: null,
      grantedBy: {
        id: user._id.toString(),
        email: user.email,
      },
      grantedAt: new Date(),
      updatedAt: new Date(),
    });

    await logAudit({
      action: AUDIT_ACTIONS.FOLDER_CREATE,
      resourceType: 'folder',
      resourceId: result.insertedId,
      roomId: targetRoomId,
      user,
      details: { path, name: cleanName },
      request,
    });

    return NextResponse.json({ ...newFolder, _id: result.insertedId }, { status: 201 });
  },
  {
    requires: 'edit',
    resource: { type: 'room', query: 'roomId' },
  },
);
