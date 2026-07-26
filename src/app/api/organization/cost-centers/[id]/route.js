import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { FinanceError } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString } from '../../../../../lib/finance/auth';
import { moneyFields, fromMinor } from '../../../../../lib/finance/money';
import { presetRange } from '../../../../../lib/finance/dates';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';

const CODE_RE = /^[A-Z0-9_-]{1,20}$/i;

// See the collection route: allocations carry free-text costCenter keys and
// possibly-string amounts with no amountMinor, so convert defensively.
const ALLOC_MINOR = {
  $ifNull: [
    '$allocations.amountMinor',
    { $round: [{ $multiply: [{ $convert: { input: '$allocations.amount', to: 'double', onError: 0, onNull: 0 } }, 100] }, 0] },
  ],
};

const normKey = (v) => String(v == null ? '' : v).trim().toLowerCase();

export async function GET(request, { params }) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const center = await db.collection('cost_centers').findOne({ _id: new ObjectId(id), deletedAt: { $exists: false } });
    if (!center) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // ---- Rollup window (same params as the collection GET) ----
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
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

    const spendRows = await db.collection('org_funds').aggregate([
      { $match: spendMatch },
      { $unwind: '$allocations' },
      { $match: { 'allocations.costCenter': { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: '$allocations.costCenter', totalMinor: { $sum: ALLOC_MINOR }, entries: { $sum: 1 } } },
    ]).toArray();

    // The free-text allocation key matches this center by CODE or NAME (case-insensitive).
    const codeKey = normKey(center.code);
    const nameKey = normKey(center.name);
    let actualMinor = 0;
    let entries = 0;
    for (const row of spendRows) {
      const k = normKey(row._id);
      if (k && (k === codeKey || k === nameKey)) {
        actualMinor += row.totalMinor || 0;
        entries += row.entries || 0;
      }
    }

    const budgetMinor = Number.isFinite(Number(center.budgetAmountMinor))
      ? Math.round(Number(center.budgetAmountMinor))
      : Math.round((Number(center.budgetAmount) || 0) * 100);
    const variancePct = budgetMinor > 0 ? ((actualMinor - budgetMinor) / budgetMinor) * 100 : null;

    return NextResponse.json({
      ...center,
      budget: fromMinor(budgetMinor),
      actual: fromMinor(actualMinor),
      remaining: fromMinor(budgetMinor - actualMinor),
      variancePct: variancePct != null ? Math.round(variancePct * 100) / 100 : null,
      spendEntries: entries,
      dateRange: { start: rangeStart, end: rangeEnd },
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/cost-centers/[id] error', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('cost_centers');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ error: 'Cost center has been deleted' }, { status: 409 });

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

    const hasBudget = budgetAmount != null && budgetAmount !== '';
    let money = {};
    if (hasBudget) {
      try {
        money = moneyFields('budgetAmount', budgetAmount);
        if (money.budgetAmountMinor < 0) throw new FinanceError('Budget cannot be negative', 400);
      } catch (err) {
        if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
        throw err;
      }
    }

    const setDoc = {
      code: cleanCode,
      name: cleanName,
      owner: capString(owner, 200),
      description: capString(description, 2000),
      ...money,
      active: active !== false,
      updatedAt: new Date(),
      updatedBy: actorFromUser(user),
    };
    const update = { $set: setDoc };
    // Clearing the budget removes both stored fields entirely.
    if (!hasBudget) update.$unset = { budgetAmount: '', budgetAmountMinor: '' };

    try {
      await col.updateOne({ _id: new ObjectId(id) }, update);
    } catch (err) {
      // Duplicate-key from the unique sparse index on `code`.
      if (err && err.code === 11000) {
        return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
      }
      throw err;
    }

    const after = { ...existing, ...setDoc };
    if (!hasBudget) {
      delete after.budgetAmount;
      delete after.budgetAmountMinor;
    }

    await recordFinanceAudit(db, {
      action: 'costcenter.update', collection: 'cost_centers', documentId: id,
      actor: actorFromUser(user), before: existing, after,
      meta: { code: cleanCode, budgetAmountMinor: money.budgetAmountMinor ?? null },
    });

    return NextResponse.json(after);
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('PUT /api/organization/cost-centers/[id] error', e);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('cost_centers');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ success: true, id, alreadyDeleted: true });

    // Soft delete — spend history keeps referencing the code; the center simply
    // stops appearing in lists and its ledger spend shows up as unmatched.
    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { deletedAt: new Date(), deletedBy: actorFromUser(user) } }
    );
    await recordFinanceAudit(db, {
      action: 'costcenter.delete', collection: 'cost_centers', documentId: id,
      actor: actorFromUser(user), before: existing,
    });

    return NextResponse.json({ success: true, id });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('DELETE /api/organization/cost-centers/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
