import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserFromToken } from '../../../../../lib/eventAuthHelper';
import { slugify } from '../../../../../lib/scheduling';

async function authed(request) {
  const token = request.cookies.get('admin_token')?.value;
  return getUserFromToken(token);
}

// PUT /api/scheduling/event-types/[id] — update an event type
export async function PUT(request, { params }) {
  try {
    const user = await authed(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const existing = await db.collection('booking_event_types').findOne({ _id: new ObjectId(id) });
    if (!existing || existing.ownerEmail !== user.email) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const updates = { updatedAt: new Date() };

    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (!t) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
      updates.title = t;
    }
    if (body.durationMinutes !== undefined) {
      const d = Number(body.durationMinutes);
      if (!Number.isFinite(d) || d < 5 || d > 1440) {
        return NextResponse.json({ error: 'Duration must be 5–1440 minutes' }, { status: 400 });
      }
      updates.durationMinutes = d;
    }
    if (body.description !== undefined) updates.description = String(body.description).trim();
    if (body.location !== undefined) updates.location = String(body.location).trim();
    if (body.color !== undefined) updates.color = body.color;
    if (body.isActive !== undefined) updates.isActive = !!body.isActive;

    if (body.slug !== undefined) {
      let base = slugify(body.slug);
      let slug = base;
      let n = 1;
      while (await db.collection('booking_event_types').findOne({
        ownerEmail: user.email, slug, _id: { $ne: new ObjectId(id) },
      })) {
        slug = `${base}-${n++}`;
      }
      updates.slug = slug;
    }

    await db.collection('booking_event_types').updateOne({ _id: new ObjectId(id) }, { $set: updates });
    const updated = await db.collection('booking_event_types').findOne({ _id: new ObjectId(id) });
    return NextResponse.json({ eventType: updated });
  } catch (e) {
    console.error('event-types PUT', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/scheduling/event-types/[id]
export async function DELETE(request, { params }) {
  try {
    const user = await authed(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const existing = await db.collection('booking_event_types').findOne({ _id: new ObjectId(id) });
    if (!existing || existing.ownerEmail !== user.email) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await db.collection('booking_event_types').deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('event-types DELETE', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
