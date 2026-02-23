import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../lib/dataroom/audit-logger';
import { validateFolderName, generateFolderPath } from '../../../../lib/dataroom/folder-utils';

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

export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const roomIdParam = searchParams.get('roomId');

    const client = await clientPromise;
    const db = client.db('resources');

    const filter = {};
    if (roomIdParam) {
      if (!ObjectId.isValid(roomIdParam)) {
        return NextResponse.json({ error: 'Invalid roomId' }, { status: 400 });
      }
      filter.roomId = new ObjectId(roomIdParam);
    }

    const docs = await db.collection('dataroom_folders').find(filter).limit(200).toArray();
    return NextResponse.json({ count: docs.length, items: docs });
  } catch (e) {
    console.error('GET /api/dataroom/folders error', e);
    return NextResponse.json({ error: 'Failed to list folders' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { roomId, name, parentId } = body;

    if (!roomId || !ObjectId.isValid(roomId)) {
      return NextResponse.json({ error: 'Valid roomId is required' }, { status: 400 });
    }

    const validation = validateFolderName(name);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const cleanName = validation.cleanName;
    const client = await clientPromise;
    const db = client.db('resources');
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

  } catch (error) {
    console.error('POST /api/dataroom/folders error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
