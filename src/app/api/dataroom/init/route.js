import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
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

function isAdminLike(user) {
  return user && (user.role === 'Admin' || user.role === 'Console admin');
}

export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const client = await clientPromise;
    const db = client.db('resources');

    // Ensure collection exists
    const collName = 'dataroom_folders';
    const exists = await db.listCollections({ name: collName }).hasNext();
    if (!exists) {
      await db.createCollection(collName, { strict: false });
      // Indexes
      await db.collection(collName).createIndexes([
        { key: { roomId: 1, path: 1 }, unique: true, name: 'room_path_unique' },
        { key: { parentId: 1 }, name: 'parent_idx' },
      ]);
    }

    // Seed: Root folder for a demo room
    const body = await request.json().catch(() => ({}));
    const roomId = body.roomId && ObjectId.isValid(body.roomId) ? new ObjectId(body.roomId) : new ObjectId('000000000000000000000001');

    const rootDoc = {
      roomId,
      name: 'Root',
      path: '/',
      parentId: null,
      createdAt: new Date(),
      createdBy: { id: user._id?.toString?.() || null, email: user.email, username: user.username },
      meta: {},
    };

    // Upsert root by unique (roomId, path)
    const upsertRes = await db.collection(collName).updateOne(
      { roomId, path: '/' },
      { $setOnInsert: rootDoc },
      { upsert: true }
    );

    const doc = await db.collection(collName).findOne({ roomId, path: '/' });

    return NextResponse.json({ ok: true, collection: collName, indexesEnsured: !exists ? 2 : 'already', upserted: upsertRes.upsertedId || null, doc });
  } catch (e) {
    console.error('POST /api/dataroom/init error', e);
    return NextResponse.json({ error: 'Failed to init dataroom' }, { status: 500 });
  }
}
