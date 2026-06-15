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

    let updateDoc = {};
    if (action === 'cancel') {
      updateDoc = {
        $set: {
          status: 'cancelled',
          cancelReason: String(body.reason || '').trim(),
          cancelledAt: new Date()
        }
      };
    } else if (action === 'restore') {
      // Restore cancelled booking back to confirmed
      updateDoc = {
        $set: {
          status: 'confirmed',
          restoredAt: new Date()
        },
        $unset: {
          cancelReason: "",
          cancelledAt: ""
        }
      };
    } else if (action === 'mark-read') {
      updateDoc = {
        $set: {
          isNew: false
        }
      };
    } else if (action === 'toggle-important') {
      updateDoc = {
        $set: {
          isImportant: !booking.isImportant
        }
      };
    } else if (action === 'set-attendance') {
      updateDoc = {
        $set: {
          attendanceStatus: body.status // e.g. 'will_attend', 'will_not_attend', 'maybe'
        }
      };
    } else {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    await db.collection('bookings').updateOne({ _id: new ObjectId(id) }, updateDoc);
    const updated = await db.collection('bookings').findOne({ _id: new ObjectId(id) });
    return NextResponse.json({ booking: updated });
  } catch (e) {
    console.error('bookings PATCH', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/scheduling/bookings/[id] — permanently delete a booking from Trash
export async function DELETE(request, { params }) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const booking = await db.collection('bookings').findOne({ _id: new ObjectId(id) });
    if (!booking || booking.ownerEmail !== user.email) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await db.collection('bookings').deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('bookings DELETE', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

