import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserFromToken } from '../../../../../lib/eventAuthHelper';

// PATCH /api/scheduling/bookings/[id] — cancel a booking
export async function PATCH(request, { params }) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const action = body.action;

    const client = await clientPromise;
    const db = client.db('resources');
    const booking = await db.collection('bookings').findOne({ _id: new ObjectId(id) });
    if (!booking || booking.ownerEmail !== user.email) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (action === 'cancel') {
      await db.collection('bookings').updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'cancelled', cancelReason: String(body.reason || '').trim(), cancelledAt: new Date() } }
      );
      const updated = await db.collection('bookings').findOne({ _id: new ObjectId(id) });
      return NextResponse.json({ booking: updated });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (e) {
    console.error('bookings PATCH', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
