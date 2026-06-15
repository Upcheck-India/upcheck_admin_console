import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { getUserFromToken } from '../../../../../lib/eventAuthHelper';

export async function GET(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    
    const unreadCount = await db
      .collection('bookings')
      .countDocuments({
        ownerEmail: user.email,
        isNew: true,
        status: 'confirmed'
      });

    return NextResponse.json({ unreadCount });
  } catch (e) {
    console.error('bookings stats GET', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
