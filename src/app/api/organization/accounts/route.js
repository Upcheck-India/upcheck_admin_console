import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

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

    const client = await clientPromise;
    const db = client.db('resources');
    const accounts = await db.collection('finance_accounts').find({}).sort({ name: 1 }).toArray();
    return NextResponse.json({ accounts });
  } catch (e) {
    console.error('GET /api/organization/accounts error', e);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { name } = body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const doc = {
      name: name.trim(),
      createdAt: new Date(),
      createdBy: { id: user._id?.toString?.() || null, email: user.email, username: user.username, role: user.role },
    };

    const client = await clientPromise;
    const db = client.db('resources');
    const res = await db.collection('finance_accounts').insertOne(doc);
    return NextResponse.json({ _id: res.insertedId, ...doc }, { status: 201 });
  } catch (e) {
    console.error('POST /api/organization/accounts error', e);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
