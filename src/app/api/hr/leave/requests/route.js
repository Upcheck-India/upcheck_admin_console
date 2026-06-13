import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireAuth, canManageUsers, logActivity } from '../../../../../lib/serverAuth';
import { toDateOnly, countWorkingDays, dateKey } from '../../../../../lib/hr/leave';
import { computeBalances } from '../../../../../lib/hr/leaveBalance';

// GET - list leave requests. view = mine | approvals | all
export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  const { searchParams } = new URL(req.url);
  const view = searchParams.get('view') || 'mine';
  const status = searchParams.get('status');
  const canManage = canManageUsers(user);

  const query = {};
  if (status) query.status = status;

  if (view === 'all' || view === 'approvals') {
    // Viewing/approving others' leave requires Console admin or users.manage.
    if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (view === 'approvals' && !status) query.status = 'pending';
  } else {
    // mine
    query.userId = user._id;
  }

  const requests = await db.collection('leave_requests').find(query).sort({ createdAt: -1 }).limit(500).toArray();
  return NextResponse.json({ requests });
}

// POST - create a leave request
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Admins may file on behalf of another user.
  let targetUser = user;
  if (data.userId && data.userId !== String(user._id)) {
    if (!canManageUsers(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!ObjectId.isValid(data.userId)) {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }
    targetUser = await db.collection('admin_users').findOne({ _id: new ObjectId(data.userId) }, { projection: { password: 0 } });
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!ObjectId.isValid(data.leaveTypeId)) {
    return NextResponse.json({ error: 'Valid leaveTypeId is required' }, { status: 400 });
  }
  const leaveType = await db.collection('leave_types').findOne({ _id: new ObjectId(data.leaveTypeId) });
  if (!leaveType || leaveType.active === false) {
    return NextResponse.json({ error: 'Leave type not found' }, { status: 404 });
  }

  const startDate = toDateOnly(data.startDate);
  const endDate = toDateOnly(data.endDate);
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Valid startDate and endDate are required' }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 });
  }
  const halfDay = data.halfDay === true;

  // Holidays in range for working-day calculation.
  const holidays = await db.collection('holidays')
    .find({ date: { $gte: startDate, $lte: endDate } }, { projection: { date: 1 } }).toArray();
  const holidayKeys = holidays.map((h) => dateKey(h.date));
  const days = countWorkingDays(startDate, endDate, holidayKeys, halfDay);
  if (days <= 0) {
    return NextResponse.json({ error: 'Selected range has no working days' }, { status: 400 });
  }

  // Overlap check against existing non-rejected/non-cancelled requests.
  const overlap = await db.collection('leave_requests').findOne({
    userId: targetUser._id,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  });
  if (overlap) {
    return NextResponse.json({ error: 'You already have a leave request overlapping these dates' }, { status: 409 });
  }

  // Balance check for paid leave types.
  if (leaveType.paid !== false) {
    const year = startDate.getUTCFullYear();
    const balances = await computeBalances(db, targetUser._id, year);
    const bal = balances.find((b) => String(b.leaveTypeId) === String(leaveType._id));
    if (bal && days > bal.available) {
      return NextResponse.json({ error: `Insufficient ${leaveType.name} balance. Available: ${bal.available}, requested: ${days}` }, { status: 400 });
    }
  }

  const autoApprove = leaveType.requiresApproval === false;
  const now = new Date();
  const doc = {
    userId: targetUser._id,
    username: targetUser.username,
    employeeName: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.username,
    department: targetUser.department || 'Unassigned',
    managerId: targetUser.managerId || null,
    leaveTypeId: leaveType._id,
    leaveTypeName: leaveType.name,
    leaveTypeCode: leaveType.code,
    startDate,
    endDate,
    halfDay,
    days,
    reason: (data.reason || '').trim(),
    status: autoApprove ? 'approved' : 'pending',
    reviewerId: autoApprove ? user._id : null,
    reviewerName: autoApprove ? user.username : null,
    reviewNote: '',
    appliedById: user._id,
    appliedAt: now,
    reviewedAt: autoApprove ? now : null,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('leave_requests').insertOne(doc);
  await logActivity(db, { action: 'leave_requested', actor: user, targetType: 'leave_request', targetId: result.insertedId, targetName: doc.leaveTypeName, metadata: { days, status: doc.status } });
  return NextResponse.json({ request: { ...doc, _id: result.insertedId } }, { status: 201 });
}
