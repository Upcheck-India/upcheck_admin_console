import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = user._id.toString();

    const pipeline = [
      { $match: { userId } },
      {
        $group: {
          _id: '$folder',
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] } },
        },
      },
    ];

    const perFolder = await db.collection('emails').aggregate(pipeline).toArray();
    const byFolder = perFolder.reduce((acc, cur) => {
      acc[cur._id] = { total: cur.total, unread: cur.unread };
      return acc;
    }, {});

    const starredCount = await db.collection('emails').countDocuments({ userId, starred: true });
    const unreadTotal = await db.collection('emails').countDocuments({ userId, read: false });

    return NextResponse.json({ byFolder, starred: { total: starredCount }, unreadTotal });
  } catch (err) {
    console.error('Mail counts error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
