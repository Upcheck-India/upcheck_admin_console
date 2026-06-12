import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireManageUsers, logActivity } from '../../../../../lib/serverAuth';
import { HOLIDAY_TYPES, toDateOnly } from '../../../../../lib/hr/leave';

// PUT - update a holiday (Console admin or users.manage)
export async function PUT(req, { params }) {
  const auth = await requireManageUsers(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const update = { updatedAt: new Date() };
  if (data.name !== undefined) update.name = String(data.name).trim();
  if (data.type !== undefined && HOLIDAY_TYPES.includes(data.type)) update.type = data.type;
  if (data.recurring !== undefined) update.recurring = !!data.recurring;
  if (data.description !== undefined) update.description = String(data.description).trim();
  if (data.date !== undefined) {
    const date = toDateOnly(data.date);
    if (!date) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    update.date = date;
  }

  const result = await db.collection('holidays').updateOne(
    { _id: new ObjectId(id) },
    { $set: update }
  );
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
  }
  await logActivity(db, { action: 'holiday_updated', actor: user, targetId: id, targetName: update.name });
  return NextResponse.json({ success: true });
}

// DELETE - remove a holiday (admin only)
export async function DELETE(req, { params }) {
  const auth = await requireManageUsers(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const result = await db.collection('holidays').deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
  }
  await logActivity(db, { action: 'holiday_deleted', actor: user, targetId: id });
  return NextResponse.json({ success: true });
}
