import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { getUserFromToken } from '../../../../lib/eventAuthHelper';
import { slugify } from '../../../../lib/scheduling';

async function authed(request) {
  const token = request.cookies.get('admin_token')?.value;
  return getUserFromToken(token);
}

// GET /api/scheduling/event-types — list the current owner's event types
export async function GET(request) {
  try {
    const user = await authed(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    const types = await db
      .collection('booking_event_types')
      .find({ ownerEmail: user.email })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ eventTypes: types });
  } catch (e) {
    console.error('event-types GET', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/scheduling/event-types — create an event type
export async function POST(request) {
  try {
    const user = await authed(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const title = String(body.title || '').trim();
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const duration = Number(body.durationMinutes);
    if (!Number.isFinite(duration) || duration < 5 || duration > 1440) {
      return NextResponse.json({ error: 'Duration must be 5–1440 minutes' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // Unique slug per owner.
    let base = slugify(body.slug || title);
    let slug = base;
    let n = 1;
    while (await db.collection('booking_event_types').findOne({ ownerEmail: user.email, slug })) {
      slug = `${base}-${n++}`;
    }

    const doc = {
      ownerEmail: user.email,
      ownerName: user.name || user.email,
      title,
      slug,
      description: String(body.description || '').trim(),
      durationMinutes: duration,
      location: String(body.location || '').trim(),
      color: body.color || '#0D84D6',
      isActive: body.isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('booking_event_types').insertOne(doc);
    return NextResponse.json({ eventType: { ...doc, _id: result.insertedId } }, { status: 201 });
  } catch (e) {
    console.error('event-types POST', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
