import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../lib/mongodb';

// GET /api/mail?folder=inbox|sent
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = (searchParams.get('folder') || 'inbox').toLowerCase();
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25', 10), 1), 100);

    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Align with /api/auth/check: validate against admin_users.sessionToken
    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const query = { userId: user._id.toString(), folder };
    const cursor = db.collection('emails')
      .find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const items = await cursor.toArray();
    const serialized = items.map(it => ({
      ...it,
      _id: it._id?.toString?.() || it._id,
    }));

    return NextResponse.json(serialized);
  } catch (err) {
    console.error('Mail list error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
