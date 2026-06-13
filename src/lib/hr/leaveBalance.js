import { ObjectId } from 'mongodb';

// Compute leave balances for a user for a given year.
// Balance per type = allocated + carriedForward - used(approved) - pending.
export async function computeBalances(db, userId, year) {
  const uid = typeof userId === 'string' ? new ObjectId(userId) : userId;
  const y = +year || new Date().getUTCFullYear();
  const start = new Date(Date.UTC(y, 0, 1));
  const end = new Date(Date.UTC(y, 11, 31, 23, 59, 59));

  const types = await db.collection('leave_types').find({ active: { $ne: false } }).sort({ name: 1 }).toArray();
  const overrides = await db.collection('leave_balances').find({ userId: uid, year: y }).toArray();
  const overrideMap = new Map(overrides.map((o) => [String(o.leaveTypeId), o]));

  // Aggregate days used/pending per leave type for the year.
  const agg = await db.collection('leave_requests').aggregate([
    { $match: { userId: uid, startDate: { $gte: start, $lte: end }, status: { $in: ['approved', 'pending'] } } },
    { $group: { _id: { leaveTypeId: '$leaveTypeId', status: '$status' }, total: { $sum: '$days' } } },
  ]).toArray();

  const usage = new Map(); // key: leaveTypeId -> { used, pending }
  for (const row of agg) {
    const key = String(row._id.leaveTypeId);
    const entry = usage.get(key) || { used: 0, pending: 0 };
    if (row._id.status === 'approved') entry.used += row.total;
    else if (row._id.status === 'pending') entry.pending += row.total;
    usage.set(key, entry);
  }

  return types.map((t) => {
    const key = String(t._id);
    const ov = overrideMap.get(key);
    const allocated = ov && Number.isFinite(ov.allocated) ? ov.allocated : (t.defaultAllocation || 0);
    const carriedForward = ov && Number.isFinite(ov.carriedForward) ? ov.carriedForward : 0;
    const u = usage.get(key) || { used: 0, pending: 0 };
    const available = +(allocated + carriedForward - u.used - u.pending).toFixed(2);
    return {
      leaveTypeId: t._id,
      name: t.name,
      code: t.code,
      color: t.color,
      paid: t.paid,
      allocated,
      carriedForward,
      used: +u.used.toFixed(2),
      pending: +u.pending.toFixed(2),
      available,
    };
  });
}
