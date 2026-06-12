import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireAuth, canManageUsers, logActivity } from '../../../../../../lib/serverAuth';

// GET - single leave request (owner, or a user manager)
export async function GET(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const request = await db.collection('leave_requests').findOne({ _id: new ObjectId(id) });
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isOwner = String(request.userId) === String(user._id);
  if (!isOwner && !canManageUsers(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ request });
}

// PATCH - approve | reject | cancel
export async function PATCH(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const action = data.action;
  if (!['approve', 'reject', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const request = await db.collection('leave_requests').findOne({ _id: new ObjectId(id) });
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const canManage = canManageUsers(user);
  const isOwner = String(request.userId) === String(user._id);
  const now = new Date();

  if (action === 'cancel') {
    if (!isOwner && !canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!['pending', 'approved'].includes(request.status)) {
      return NextResponse.json({ error: `Cannot cancel a ${request.status} request` }, { status: 400 });
    }
    await db.collection('leave_requests').updateOne(
      { _id: request._id },
      { $set: { status: 'cancelled', cancelledAt: now, cancelledBy: user._id, updatedAt: now } }
    );
    await logActivity(db, { action: 'leave_cancelled', actor: user, targetType: 'leave_request', targetId: id });
    return NextResponse.json({ success: true, status: 'cancelled' });
  }

  // approve / reject
  if (!canManage) return NextResponse.json({ error: 'You do not have permission to review leave requests' }, { status: 403 });
  if (isOwner) return NextResponse.json({ error: 'You cannot review your own request' }, { status: 403 });
  if (request.status !== 'pending') {
    return NextResponse.json({ error: `Request is already ${request.status}` }, { status: 400 });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  await db.collection('leave_requests').updateOne(
    { _id: request._id },
    { $set: { status: newStatus, reviewerId: user._id, reviewerName: user.username, reviewNote: (data.reviewNote || '').trim(), reviewedAt: now, updatedAt: now } }
  );
  await logActivity(db, { action: `leave_${newStatus}`, actor: user, targetType: 'leave_request', targetId: id, metadata: { employee: request.username, days: request.days } });
  return NextResponse.json({ success: true, status: newStatus });
}

// DELETE - remove a leave request (owner if pending, or admin)
export async function DELETE(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const request = await db.collection('leave_requests').findOne({ _id: new ObjectId(id) });
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const canManage = canManageUsers(user);
  const isOwner = String(request.userId) === String(user._id);
  if (!canManage && !(isOwner && request.status === 'pending')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await db.collection('leave_requests').deleteOne({ _id: request._id });
  await logActivity(db, { action: 'leave_deleted', actor: user, targetType: 'leave_request', targetId: id });
  return NextResponse.json({ success: true });
}
