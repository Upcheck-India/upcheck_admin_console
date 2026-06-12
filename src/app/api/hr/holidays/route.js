import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin, logActivity } from '../../../../lib/serverAuth';
import { HOLIDAY_TYPES, toDateOnly, dateKey } from '../../../../lib/hr/leave';

// GET - list holidays, optionally filtered by year
export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db } = auth;

  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year');
  const query = {};
  if (year && /^\d{4}$/.test(year)) {
    const start = new Date(Date.UTC(+year, 0, 1));
    const end = new Date(Date.UTC(+year, 11, 31, 23, 59, 59));
    query.date = { $gte: start, $lte: end };
  }
  const holidays = await db.collection('holidays').find(query).sort({ date: 1 }).toArray();
  return NextResponse.json({ holidays });
}

// POST - create a holiday (admin only)
export async function POST(req) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!data.name || !data.name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  const date = toDateOnly(data.date);
  if (!date) {
    return NextResponse.json({ error: 'A valid date is required' }, { status: 400 });
  }

  const existing = await db.collection('holidays').findOne({ date });
  if (existing) {
    return NextResponse.json({ error: 'A holiday already exists on this date' }, { status: 409 });
  }

  const now = new Date();
  const doc = {
    name: data.name.trim(),
    date,
    type: HOLIDAY_TYPES.includes(data.type) ? data.type : 'public',
    recurring: data.recurring === true,
    description: (data.description || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('holidays').insertOne(doc);
  await logActivity(db, { action: 'holiday_created', actor: user, targetId: result.insertedId, targetName: doc.name, metadata: { date: dateKey(date) } });
  return NextResponse.json({ holiday: { ...doc, _id: result.insertedId } }, { status: 201 });
}
