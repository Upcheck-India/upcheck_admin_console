import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { getUserFromToken } from '../../../../lib/eventAuthHelper';

// GET /api/scheduling/bookings?scope=upcoming|past|all — owner's bookings
export async function GET(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'upcoming';

    const query = { ownerEmail: user.email };
    const now = new Date();
    if (scope === 'upcoming') {
      query.startTime = { $gte: now };
      query.status = 'confirmed';
    } else if (scope === 'past') {
      query.startTime = { $lt: now };
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const bookings = await db
      .collection('bookings')
      .find(query)
      .sort({ startTime: scope === 'past' ? -1 : 1 })
      .limit(500)
      .toArray();

    return NextResponse.json({ bookings });
  } catch (e) {
    console.error('bookings GET', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
