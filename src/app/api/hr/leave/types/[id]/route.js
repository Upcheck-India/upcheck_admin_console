import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireAdmin, logActivity } from '../../../../../../lib/serverAuth';

// PUT - update a leave type (admin only)
export async function PUT(req, { params }) {
  const auth = await requireAdmin(req);
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
  if (data.defaultAllocation !== undefined) update.defaultAllocation = Math.max(0, +data.defaultAllocation || 0);
  if (data.color !== undefined) update.color = data.color;
  if (data.paid !== undefined) update.paid = !!data.paid;
  if (data.requiresApproval !== undefined) update.requiresApproval = !!data.requiresApproval;
  if (data.carryForward !== undefined) update.carryForward = !!data.carryForward;
  if (data.active !== undefined) update.active = !!data.active;

  const result = await db.collection('leave_types').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: 'after' }
  );
  const doc = result.value || result; // driver compatibility
  if (!doc || !doc._id) {
    return NextResponse.json({ error: 'Leave type not found' }, { status: 404 });
  }
  await logActivity(db, { action: 'leave_type_updated', actor: user, targetId: id, targetName: update.name });
  return NextResponse.json({ type: doc });
}

// DELETE - soft delete (deactivate) a leave type (admin only)
export async function DELETE(req, { params }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const result = await db.collection('leave_types').updateOne(
    { _id: new ObjectId(id) },
    { $set: { active: false, updatedAt: new Date() } }
  );
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'Leave type not found' }, { status: 404 });
  }
  await logActivity(db, { action: 'leave_type_deactivated', actor: user, targetId: id });
  return NextResponse.json({ success: true });
}
