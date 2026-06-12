import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireAuth, requireAdmin, isAdminRole, logActivity } from '../../../../../lib/serverAuth';
import { computeBalances } from '../../../../../lib/hr/leaveBalance';

// GET - leave balances for a user/year. Non-admins can only view their own.
export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  const { searchParams } = new URL(req.url);
  const year = +searchParams.get('year') || new Date().getUTCFullYear();
  let userId = searchParams.get('userId');

  if (!userId) {
    userId = String(user._id);
  } else if (!isAdminRole(user.role) && userId !== String(user._id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
  }

  const balances = await computeBalances(db, userId, year);
  return NextResponse.json({ userId, year, balances });
}

// POST - admin sets an allocation/carry-forward override for a user+type+year.
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

  const { userId, leaveTypeId } = data;
  const year = +data.year || new Date().getUTCFullYear();
  if (!ObjectId.isValid(userId) || !ObjectId.isValid(leaveTypeId)) {
    return NextResponse.json({ error: 'Valid userId and leaveTypeId are required' }, { status: 400 });
  }

  const set = { updatedAt: new Date(), updatedBy: user._id };
  if (data.allocated !== undefined) set.allocated = Math.max(0, +data.allocated || 0);
  if (data.carriedForward !== undefined) set.carriedForward = Math.max(0, +data.carriedForward || 0);

  await db.collection('leave_balances').updateOne(
    { userId: new ObjectId(userId), leaveTypeId: new ObjectId(leaveTypeId), year },
    { $set: set, $setOnInsert: { userId: new ObjectId(userId), leaveTypeId: new ObjectId(leaveTypeId), year, createdAt: new Date() } },
    { upsert: true }
  );
  await logActivity(db, { action: 'leave_balance_adjusted', actor: user, targetId: userId, metadata: { leaveTypeId, year, ...set } });

  const balances = await computeBalances(db, userId, year);
  return NextResponse.json({ userId, year, balances });
}
