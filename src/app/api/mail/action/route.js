import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    const { ids, action, value } = await request.json();
    if (!Array.isArray(ids) || !ids.length || !action) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const _ids = ids.filter(Boolean).map(id => {
      try { return new ObjectId(id); } catch { return null; }
    }).filter(Boolean);

    const baseFilter = { _id: { $in: _ids }, userId: user._id.toString() };

    let result;
    switch (action) {
      case 'star':
        result = await db.collection('emails').updateMany(baseFilter, { $set: { starred: !!value } });
        break;
      case 'read':
        result = await db.collection('emails').updateMany(baseFilter, { $set: { read: !!value } });
        break;
      case 'archive':
        result = await db.collection('emails').updateMany(baseFilter, { $set: { folder: 'archive' } });
        break;
      case 'trash':
        result = await db.collection('emails').updateMany(baseFilter, { $set: { folder: 'trash' } });
        break;
      case 'restore':
        result = await db.collection('emails').updateMany(baseFilter, { $set: { folder: 'inbox' } });
        break;
      case 'delete':
        result = await db.collection('emails').deleteMany(baseFilter);
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, modified: result?.modifiedCount ?? 0, deleted: result?.deletedCount ?? 0 });
  } catch (err) {
    console.error('Mail action error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
