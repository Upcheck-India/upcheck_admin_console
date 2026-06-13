import { NextResponse } from 'next/server';
import { requireAuth, requireManageUsers, logActivity } from '../../../../lib/serverAuth';
import { HOLIDAY_TYPES, toDateOnly, dateKey, buildDefaultHolidaysForYear } from '../../../../lib/hr/leave';

// Seed the default national holidays for a year the first time it is viewed.
// Tracked via the holiday_seed_years collection so an admin deleting a default
// holiday won't have it re-created on the next page load. Existing holidays on
// the same date (e.g. manually added) are preserved.
async function ensureYearSeeded(db, year) {
  const seeded = await db.collection('holiday_seed_years').findOne({ year });
  if (seeded) return;
  const now = new Date();
  for (const d of buildDefaultHolidaysForYear(year)) {
    await db.collection('holidays').updateOne(
      { date: d.date },
      { $setOnInsert: { ...d, createdAt: now, updatedAt: now } },
      { upsert: true }
    );
  }
  await db.collection('holiday_seed_years').insertOne({ year, seededAt: now });
}

// GET - list holidays, optionally filtered by year
export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db } = auth;

  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year');
  const query = {};
  if (year && /^\d{4}$/.test(year)) {
    await ensureYearSeeded(db, +year);
    const start = new Date(Date.UTC(+year, 0, 1));
    const end = new Date(Date.UTC(+year, 11, 31, 23, 59, 59));
    query.date = { $gte: start, $lte: end };
  }
  const holidays = await db.collection('holidays').find(query).sort({ date: 1 }).toArray();
  return NextResponse.json({ holidays });
}

// POST - create a holiday (Console admin or users.manage)
export async function POST(req) {
  const auth = await requireManageUsers(req);
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
    source: 'custom',
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('holidays').insertOne(doc);
  await logActivity(db, { action: 'holiday_created', actor: user, targetId: result.insertedId, targetName: doc.name, metadata: { date: dateKey(date) } });
  return NextResponse.json({ holiday: { ...doc, _id: result.insertedId } }, { status: 201 });
}
