/**
 * Database side of claimable time blocks. The rules live in scheduleBlocks.js
 * (pure); everything that reads or writes Mongo lives here so both the claim
 * route and the approval route go through exactly one implementation.
 *
 * The important part is reserveSlots(). See the comment above it.
 */

import { ObjectId } from 'mongodb';
import { claimSlotKeys, dayKeyFor, weekKeyFor, isAdmitted, isBlockAdmin } from './scheduleBlocks.js';

export const BLOCKS = 'schedule_blocks';
export const CLAIMS = 'schedule_claims';
export const SLOTS = 'schedule_claim_slots';

/** Team ids this user belongs to, as strings. Matches the repo's mixed storage. */
export async function userTeamIds(db, user) {
  const idStr = String(user._id);
  const teams = await db.collection('teams').find(
    { $or: [{ members: idStr }, { lead: idStr }, { members: user._id }, { lead: user._id }] },
    { projection: { _id: 1 } },
  ).toArray();
  return teams.map((t) => String(t._id));
}

/** The user shape validateClaim() expects. */
export async function withTeams(db, user) {
  return { _id: user._id, role: user.role, teamIds: await userTeamIds(db, user) };
}

export function displayName(user) {
  const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return full || user.name || user.username || user.email || 'Someone';
}

export async function loadBlock(db, id) {
  if (!ObjectId.isValid(id)) return null;
  return db.collection(BLOCKS).findOne({ _id: new ObjectId(id) });
}

/** Confirmed claims in this block overlapping [start, end). Half-open. */
export async function overlappingClaims(db, blockId, start, end, excludeClaimId = null) {
  const q = {
    blockId: String(blockId),
    status: 'confirmed',
    startTime: { $lt: end },
    endTime: { $gt: start },
  };
  if (excludeClaimId) q._id = { $ne: new ObjectId(excludeClaimId) };
  return db.collection(CLAIMS).find(q, { projection: { startTime: 1, endTime: 1, userId: 1 } }).toArray();
}

/** This user's confirmed minutes in the block, bucketed by day and week key. */
export async function quotaUsage(db, blockId, userId, dayKey, weekKey, excludeClaimId = null) {
  const base = { blockId: String(blockId), userId: String(userId), status: 'confirmed' };
  if (excludeClaimId) base._id = { $ne: new ObjectId(excludeClaimId) };
  const rows = await db.collection(CLAIMS).find(
    { ...base, $or: [{ dayKey }, { weekKey }] },
    { projection: { minutes: 1, dayKey: 1, weekKey: 1 } },
  ).toArray();
  let dayMinutes = 0;
  let weekMinutes = 0;
  let dayClaims = 0;
  for (const r of rows) {
    if (r.dayKey === dayKey) { dayMinutes += r.minutes || 0; dayClaims += 1; }
    if (r.weekKey === weekKey) weekMinutes += r.minutes || 0;
  }
  return { dayMinutes, weekMinutes, dayClaims };
}

/**
 * Approved leave covering the claim's date. Advisory only — never refuses.
 * leave_requests stores date-only UTC midnights.
 */
export async function leaveWarningFor(db, userId, dayKey) {
  try {
    const at = new Date(`${dayKey}T00:00:00.000Z`);
    const row = await db.collection('leave_requests').findOne({
      userId: new ObjectId(String(userId)),
      status: 'approved',
      startDate: { $lte: at },
      endDate: { $gte: at },
    }, { projection: { leaveTypeName: 1, startDate: 1, endDate: 1 } });
    if (!row) return null;
    return {
      leaveTypeName: row.leaveTypeName || 'Leave',
      startDate: row.startDate,
      endDate: row.endDate,
    };
  } catch {
    return null;                                     // never block a claim on this
  }
}

/**
 * Delete slot rows whose owning claim is gone or is no longer confirmed —
 * i.e. rows a crash orphaned between the insertMany and the claim insert.
 * Only ever runs on the conflict path, so it costs nothing in the normal case,
 * and it replaces the startup sweep the plan suggested (which would have had
 * to scan the whole collection on every boot).
 * Returns true if it freed anything.
 */
async function sweepOrphanSlots(db, slotKeys) {
  const rows = await db.collection(SLOTS)
    .find({ slotKey: { $in: slotKeys }, active: true }, { projection: { claimId: 1 } }).toArray();
  if (!rows.length) return false;
  const ids = [...new Set(rows.map((r) => String(r.claimId)))].filter(ObjectId.isValid);
  const live = await db.collection(CLAIMS)
    .find({ _id: { $in: ids.map((i) => new ObjectId(i)) }, status: 'confirmed' }, { projection: { _id: 1 } })
    .toArray();
  const liveSet = new Set(live.map((c) => String(c._id)));
  const orphans = ids.filter((i) => !liveSet.has(i));
  if (!orphans.length) return false;
  const res = await db.collection(SLOTS).deleteMany({ claimId: { $in: orphans.map((i) => new ObjectId(i)) } });
  return (res.deletedCount || 0) > 0;
}

/**
 * Reserve every granularity slot the claim occupies, atomically.
 *
 * The unique partial index on { slotKey, seat } where active:true is the
 * authority — not a read-then-write check, which two concurrent requests can
 * both pass. The loser gets a duplicate-key error from Mongo, which the route
 * turns into a 409.
 *
 * insertMany({ordered:true}) is atomic per document, not per batch, so a
 * partial failure leaves rows behind: the catch deletes them by claimId before
 * trying the next seat.
 *
 * ponytail: one seat number for the whole claim rather than per-slot seat
 * search. Simpler, and only under-books in interleavings that need a
 * per-slot bin-packing search; revisit if a high-capacity block ever
 * reports phantom "fully booked".
 */
export async function reserveSlots(db, { blockId, claimId, userId, start, end, granularityMinutes, capacity }) {
  const slots = claimSlotKeys(String(blockId), start, end, granularityMinutes);
  if (!slots.length) return { ok: false, conflict: false, error: 'Claim covers no slots' };
  const coll = db.collection(SLOTS);
  const seats = Math.max(1, capacity || 1);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (let seat = 0; seat < seats; seat += 1) {
      const now = new Date();
      const docs = slots.map((s) => ({
        claimId: new ObjectId(String(claimId)),
        blockId: String(blockId),
        userId: String(userId),
        slotKey: s.slotKey,
        startTime: s.startTime,
        seat,
        active: true,
        createdAt: now,
      }));
      try {
        await coll.insertMany(docs, { ordered: true });
        return { ok: true, seat };
      } catch (e) {
        await coll.deleteMany({ claimId: new ObjectId(String(claimId)) });
        const dup = e?.code === 11000 || e?.writeErrors?.some((w) => w?.err?.code === 11000 || w?.code === 11000);
        if (!dup) throw e;
      }
    }
    // Every seat collided. Once, check whether the blockers are orphans.
    if (attempt === 0) {
      const freed = await sweepOrphanSlots(db, slots.map((s) => s.slotKey));
      if (!freed) break;
    }
  }
  return { ok: false, conflict: true };
}

/** Give the slots back. Deleting keeps the unique index small. */
export async function releaseSlots(db, claimId) {
  await db.collection(SLOTS).deleteMany({ claimId: new ObjectId(String(claimId)) });
}

/**
 * Insert a confirmed claim and its slot reservation, or fail with conflict.
 * Slots go in first so a crash can never leave a claim that holds nothing.
 */
export async function insertConfirmedClaim(db, block, doc) {
  const claimId = new ObjectId();
  const res = await reserveSlots(db, {
    blockId: block._id,
    claimId,
    userId: doc.userId,
    start: doc.startTime,
    end: doc.endTime,
    granularityMinutes: block.window.granularityMinutes,
    capacity: block.rules.capacity,
  });
  if (!res.ok) return res;
  const claim = { ...doc, _id: claimId, seat: res.seat, status: 'confirmed' };
  try {
    await db.collection(CLAIMS).insertOne(claim);
  } catch (e) {
    await releaseSlots(db, claimId);
    throw e;
  }
  return { ok: true, claim };
}

export { isAdmitted, isBlockAdmin, dayKeyFor, weekKeyFor };
