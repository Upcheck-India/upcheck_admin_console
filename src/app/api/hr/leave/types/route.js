import { NextResponse } from 'next/server';
import { requireAuth, requireManageUsers, logActivity } from '../../../../../lib/serverAuth';
import { DEFAULT_LEAVE_TYPES } from '../../../../../lib/hr/leave';

// GET - list leave types (seeds defaults on first use)
export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db } = auth;

  const col = db.collection('leave_types');
  const count = await col.countDocuments({});
  if (count === 0) {
    const now = new Date();
    await col.insertMany(
      DEFAULT_LEAVE_TYPES.map((t) => ({ ...t, active: true, createdAt: now, updatedAt: now }))
    );
  }

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const query = includeInactive ? {} : { active: { $ne: false } };
  const types = await col.find(query).sort({ name: 1 }).toArray();
  return NextResponse.json({ types });
}

// POST - create a leave type (Console admin or users.manage)
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

  const code = (data.code || data.name).trim().toUpperCase().replace(/\s+/g, '_').slice(0, 12);
  const existing = await db.collection('leave_types').findOne({ code });
  if (existing) {
    return NextResponse.json({ error: 'A leave type with this code already exists' }, { status: 409 });
  }

  const now = new Date();
  const doc = {
    name: data.name.trim(),
    code,
    defaultAllocation: Number.isFinite(+data.defaultAllocation) ? Math.max(0, +data.defaultAllocation) : 0,
    color: data.color || '#3b82f6',
    paid: data.paid !== false,
    requiresApproval: data.requiresApproval !== false,
    carryForward: data.carryForward === true,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('leave_types').insertOne(doc);
  await logActivity(db, { action: 'leave_type_created', actor: user, targetId: result.insertedId, targetName: doc.name });
  return NextResponse.json({ type: { ...doc, _id: result.insertedId } }, { status: 201 });
}
