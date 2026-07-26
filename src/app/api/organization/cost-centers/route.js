import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { escapeRegex, FinanceError } from '../../../../lib/finance/tx';
import { requireFinanceAdmin, capString, parseLimit } from '../../../../lib/finance/auth';
import { moneyFields, fromMinor } from '../../../../lib/finance/money';
import { presetRange } from '../../../../lib/finance/dates';
import { recordFinanceAudit, actorFromUser } from '../../../../lib/finance/audit';

// Cost center codes: short uppercase identifiers (stored uppercased, unique index).
const CODE_RE = /^[A-Z0-9_-]{1,20}$/i;

// Aggregation expression that yields integer paise for an allocation's amount.
// Allocations are written by the funds Entry modal, which stores `amount` as the
// raw form value (often a STRING) and never writes `amountMinor` — so we convert
// defensively and fall back to 0 for junk.
const ALLOC_MINOR = {
  $ifNull: [
    '$allocations.amountMinor',
    { $round: [{ $multiply: [{ $convert: { input: '$allocations.amount', to: 'double', onError: 0, onNull: 0 } }, 100] }, 0] },
  ],
};

const normKey = (v) => String(v == null ? '' : v).trim().toLowerCase();

/**
 * Sum actual spend per allocation key from the org_funds ledger.
 * `allocations[].costCenter` is free text typed in the funds UI, so a key may be
 * a cost center's CODE or its NAME in any case — resolution happens in the caller.
 */
async function aggregateSpend(db, { accountId, rangeStart, rangeEnd }) {
  const spendMatch = {
    kind: 'out',
    deletedAt: { $exists: false },
    allocations: { $exists: true, $ne: [] },
  };
  if (accountId) spendMatch.accountId = accountId;
  if (rangeStart || rangeEnd) {
    spendMatch.date = {};
    if (rangeStart) spendMatch.date.$gte = rangeStart;
    if (rangeEnd) spendMatch.date.$lte = rangeEnd;
  }

  const rows = await db.collection('org_funds').aggregate([
    { $match: spendMatch },
    { $unwind: '$allocations' },
    { $match: { 'allocations.costCenter': { $exists: true, $nin: [null, ''] } } },
    { $group: { _id: '$allocations.costCenter', totalMinor: { $sum: ALLOC_MINOR }, entries: { $sum: 1 } } },
  ]).toArray();
  return rows;
}

/** Resolve the effective date window from query params (custom range wins over preset). */
function resolveRange(searchParams) {
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const datePreset = searchParams.get('datePreset');
  let rangeStart = startDate ? new Date(startDate) : null;
  let rangeEnd = endDate ? new Date(endDate) : null;
  if (rangeStart && Number.isNaN(rangeStart.getTime())) rangeStart = null;
  if (rangeEnd && Number.isNaN(rangeEnd.getTime())) rangeEnd = null;
  if (!rangeStart && !rangeEnd && datePreset) {
    const r = presetRange(datePreset, new Date());
    rangeStart = r.start;
    rangeEnd = r.end;
  }
  return { rangeStart, rangeEnd };
}

export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const limit = parseLimit(searchParams.get('limit'), { def: 200, max: 1000 });
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10) || 0);
    const accountId = searchParams.get('accountId');
    const { rangeStart, rangeEnd } = resolveRange(searchParams);

    // ---- Cost center list (soft-deleted rows are always excluded) ----
    const filter = { deletedAt: { $exists: false } };
    if (!includeInactive) filter.active = { $ne: false };
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { code: { $regex: safe, $options: 'i' } },
        { name: { $regex: safe, $options: 'i' } },
        { owner: { $regex: safe, $options: 'i' } },
      ];
    }

    const col = db.collection('cost_centers');
    const totalCount = await col.countDocuments(filter);
    const centers = await col.find(filter).sort({ code: 1 }).skip(skip).limit(limit).toArray();

    // ---- Actual spend per allocation key (from the org_funds ledger) ----
    const spendRows = await aggregateSpend(db, { accountId, rangeStart, rangeEnd });

    // Resolve each free-text allocation key onto a cost center by CODE or NAME
    // (case-insensitive). We resolve against ALL live centers — not just the
    // current page — so paginating never misreports matched spend as unmatched.
    const allLive = await col
      .find({ deletedAt: { $exists: false } }, { projection: { code: 1, name: 1 } })
      .toArray();
    const keyToCenterId = new Map();
    // Names first, then codes, so a code always wins if the two ever collide.
    for (const c of allLive) {
      const nameKey = normKey(c.name);
      if (nameKey && !keyToCenterId.has(nameKey)) keyToCenterId.set(nameKey, String(c._id));
    }
    for (const c of allLive) {
      const codeKey = normKey(c.code);
      if (codeKey) keyToCenterId.set(codeKey, String(c._id));
    }

    const actualByCenterId = new Map(); // centerId -> { actualMinor, entries }
    const unmatched = [];
    for (const row of spendRows) {
      const centerId = keyToCenterId.get(normKey(row._id));
      if (centerId) {
        const cur = actualByCenterId.get(centerId) || { actualMinor: 0, entries: 0 };
        cur.actualMinor += row.totalMinor || 0;
        cur.entries += row.entries || 0;
        actualByCenterId.set(centerId, cur);
      } else {
        unmatched.push({ key: String(row._id), total: fromMinor(row.totalMinor || 0), entries: row.entries || 0 });
      }
    }
    unmatched.sort((a, b) => b.total - a.total);

    // ---- Merge budget vs actual per cost center ----
    const items = centers.map((c) => {
      const spend = actualByCenterId.get(String(c._id)) || { actualMinor: 0, entries: 0 };
      const budgetMinor = Number.isFinite(Number(c.budgetAmountMinor))
        ? Math.round(Number(c.budgetAmountMinor))
        : Math.round((Number(c.budgetAmount) || 0) * 100);
      const actualMinor = spend.actualMinor;
      const remainingMinor = budgetMinor - actualMinor;
      const variancePct = budgetMinor > 0 ? ((actualMinor - budgetMinor) / budgetMinor) * 100 : null;
      return {
        ...c,
        budget: fromMinor(budgetMinor),
        actual: fromMinor(actualMinor),
        remaining: fromMinor(remainingMinor),
        variancePct: variancePct != null ? Math.round(variancePct * 100) / 100 : null,
        spendEntries: spend.entries,
      };
    });

    // ---- Portfolio summary across the returned page ----
    const totalBudgetMinor = items.reduce((s, i) => s + Math.round((i.budget || 0) * 100), 0);
    const totalActualMinor = items.reduce((s, i) => s + Math.round((i.actual || 0) * 100), 0);
    const unmatchedMinor = unmatched.reduce((s, u) => s + Math.round((u.total || 0) * 100), 0);

    const summary = {
      totalCenters: totalCount,
      totalBudget: fromMinor(totalBudgetMinor),
      totalActual: fromMinor(totalActualMinor),
      totalRemaining: fromMinor(totalBudgetMinor - totalActualMinor),
      overBudgetCount: items.filter((i) => i.budget > 0 && i.actual > i.budget).length,
      unmatchedSpend: fromMinor(unmatchedMinor),
    };

    return NextResponse.json({
      items,
      unmatched,
      summary,
      dateRange: { start: rangeStart, end: rangeEnd },
      pagination: { total: totalCount, skip, limit, returned: items.length },
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/cost-centers error', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json();
    const { code, name, owner, description, budgetAmount, active } = body || {};

    const rawCode = capString(code, 40);
    const cleanName = capString(name, 200);
    if (!rawCode) return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    if (!CODE_RE.test(rawCode)) {
      return NextResponse.json({ error: 'Code must be 1-20 letters, digits, _ or -' }, { status: 400 });
    }
    if (!cleanName) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const cleanCode = rawCode.toUpperCase();

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('cost_centers');

    let money = {};
    if (budgetAmount != null && budgetAmount !== '') {
      try {
        money = moneyFields('budgetAmount', budgetAmount); // validates & rounds to paise
        if (money.budgetAmountMinor < 0) throw new FinanceError('Budget cannot be negative', 400);
      } catch (err) {
        if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
        throw err;
      }
    }

    const doc = {
      code: cleanCode,
      name: cleanName,
      owner: capString(owner, 200),
      description: capString(description, 2000),
      ...money,
      active: active !== false,
      createdAt: new Date(),
      createdBy: actorFromUser(user),
    };

    let res;
    try {
      res = await col.insertOne(doc);
    } catch (err) {
      // Duplicate-key from the unique sparse index on `code`.
      if (err && err.code === 11000) {
        return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
      }
      throw err;
    }

    await recordFinanceAudit(db, {
      action: 'costcenter.create', collection: 'cost_centers', documentId: res.insertedId,
      actor: actorFromUser(user), after: doc, meta: { code: cleanCode, budgetAmountMinor: money.budgetAmountMinor ?? null },
    });

    return NextResponse.json({ _id: res.insertedId, ...doc }, { status: 201 });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/cost-centers error', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
