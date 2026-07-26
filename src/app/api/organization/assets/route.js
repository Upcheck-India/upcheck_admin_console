import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { escapeRegex, assertAccountExists, FinanceError } from '../../../../lib/finance/tx';
import { requireFinanceAdmin, capString, capTags, parseLimit } from '../../../../lib/finance/auth';
import { moneyFields, fromMinor, readMinor } from '../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../lib/finance/audit';

// ---------------------------------------------------------------------------
// Fixed assets register — collection `fixed_assets`
// Straight-line depreciation computed on read, in INTEGER PAISE so there is no
// floating-point drift. Invariants:
//   - months elapsed capped at usefulLifeMonths (depreciation stops at end of
//     life, and at the disposal date for disposed assets)
//   - monthly charge = floor((cost - salvage) / life); the FINAL month absorbs
//     the rounding remainder so accumulated lands exactly on (cost - salvage)
//   - net book value therefore never dips below salvage value
// ---------------------------------------------------------------------------

const MAX_LIFE_MONTHS = 600; // 50 years

/** Straight-line depreciation snapshot for one asset (all *Minor = integer paise). */
function depreciationAsOf(asset, asOf = new Date()) {
  const costMinor = readMinor(asset, 'cost');
  const salvageMinor = readMinor(asset, 'salvageValue');
  const life = Math.max(1, parseInt(asset.usefulLifeMonths, 10) || 1);
  const start = new Date(asset.purchaseDate);
  const end = asset.status === 'disposed' && asset.disposedAt ? new Date(asset.disposedAt) : asOf;
  let months = 0;
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  }
  if (!Number.isFinite(months) || months < 0) months = 0;
  if (months > life) months = life;
  const depreciable = Math.max(0, costMinor - salvageMinor);
  const monthlyMinor = Math.floor(depreciable / life);
  // Final month absorbs the rounding remainder.
  const accumulated = months >= life ? depreciable : monthlyMinor * months;
  return {
    monthsElapsed: months,
    accumulatedMinor: accumulated,
    netBookValueMinor: costMinor - accumulated,
    monthlyMinor,
  };
}

export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const accountId = searchParams.get('accountId');
    const search = searchParams.get('search');
    const limit = parseLimit(searchParams.get('limit'), { def: 500, max: 2000 });
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10) || 0);

    // Soft-deleted assets are excluded from lists AND from every total below.
    const filter = { deletedAt: { $exists: false } };
    if (status && ['active', 'disposed'].includes(status)) filter.status = status;
    if (category) filter.category = category;
    if (accountId) filter.accountId = accountId;
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { serialNumber: { $regex: safe, $options: 'i' } },
      ];
    }

    const col = db.collection('fixed_assets');

    // Portfolio summary is computed over ALL matching assets (not just the
    // current page), using a lean projection of exactly what depreciationAsOf
    // needs.
    const summaryDocs = await col
      .find(filter)
      .project({ cost: 1, costMinor: 1, salvageValue: 1, salvageValueMinor: 1, usefulLifeMonths: 1, purchaseDate: 1, status: 1, disposedAt: 1 })
      .toArray();
    const totalCount = summaryDocs.length;

    const now = new Date();
    let totalCostMinor = 0;
    let totalAccumMinor = 0;
    let totalNbvMinor = 0;
    let activeCount = 0;
    let disposedCount = 0;
    for (const doc of summaryDocs) {
      // Disposed assets have left the books, so they count but don't total.
      if (doc.status === 'disposed') {
        disposedCount += 1;
        continue;
      }
      activeCount += 1;
      const dep = depreciationAsOf(doc, now);
      totalCostMinor += readMinor(doc, 'cost');
      totalAccumMinor += dep.accumulatedMinor;
      totalNbvMinor += dep.netBookValueMinor;
    }

    const docs = await col
      .find(filter)
      .sort({ purchaseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const items = docs.map((doc) => {
      const dep = depreciationAsOf(doc, now);
      return {
        ...doc,
        cost: fromMinor(readMinor(doc, 'cost')),
        salvageValue: fromMinor(readMinor(doc, 'salvageValue')),
        monthlyDepreciation: fromMinor(dep.monthlyMinor),
        accumulatedDepreciation: fromMinor(dep.accumulatedMinor),
        netBookValue: fromMinor(dep.netBookValueMinor),
        monthsElapsed: dep.monthsElapsed,
      };
    });

    const summary = {
      totalCost: fromMinor(totalCostMinor),
      totalAccumulatedDepreciation: fromMinor(totalAccumMinor),
      totalNetBookValue: fromMinor(totalNbvMinor),
      assetCount: totalCount,
      activeCount,
      disposedCount,
    };

    return NextResponse.json({
      items,
      summary,
      pagination: { total: totalCount, skip, limit, returned: items.length },
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/assets error', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json();
    const {
      name, category, accountId, purchaseDate, cost, salvageValue,
      usefulLifeMonths, method, assignedTo, location, serialNumber, notes, tags,
    } = body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!purchaseDate) {
      return NextResponse.json({ error: 'Purchase date is required' }, { status: 400 });
    }
    const purchase = new Date(purchaseDate);
    if (Number.isNaN(purchase.getTime())) {
      return NextResponse.json({ error: 'Invalid purchase date' }, { status: 400 });
    }
    const life = parseInt(usefulLifeMonths, 10);
    if (!Number.isInteger(life) || life < 1 || life > MAX_LIFE_MONTHS) {
      return NextResponse.json({ error: `Useful life must be an integer between 1 and ${MAX_LIFE_MONTHS} months` }, { status: 400 });
    }
    if (method != null && method !== '' && method !== 'straight_line') {
      return NextResponse.json({ error: 'Only straight_line depreciation is supported' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    let costMoney;
    let salvageMoney;
    try {
      // accountId is optional; when provided it must reference a real account.
      if (accountId) await assertAccountExists(db, accountId);
      costMoney = moneyFields('cost', cost); // validates & rounds to paise
      if (costMoney.costMinor <= 0) throw new FinanceError('Cost must be greater than zero', 400);
      salvageMoney = moneyFields('salvageValue', salvageValue == null || salvageValue === '' ? 0 : salvageValue);
      if (salvageMoney.salvageValueMinor < 0) throw new FinanceError('Salvage value cannot be negative', 400);
      if (salvageMoney.salvageValueMinor >= costMoney.costMinor) {
        throw new FinanceError('Salvage value must be less than cost', 400);
      }
    } catch (err) {
      if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
      throw err;
    }

    const doc = {
      name: capString(name, 200),
      category: capString(category, 100) || 'other',
      accountId: accountId ? String(accountId) : null,
      purchaseDate: purchase,
      ...costMoney,
      ...salvageMoney,
      usefulLifeMonths: life,
      method: 'straight_line',
      assignedTo: capString(assignedTo, 200),
      location: capString(location, 200),
      serialNumber: capString(serialNumber, 200),
      status: 'active',
      notes: capString(notes, 2000),
      tags: capTags(tags),
      createdAt: new Date(),
      createdBy: actorFromUser(user),
    };

    const res = await db.collection('fixed_assets').insertOne(doc);
    await recordFinanceAudit(db, {
      action: 'asset.create', collection: 'fixed_assets', documentId: res.insertedId,
      actor: actorFromUser(user), after: doc,
      meta: { accountId: doc.accountId, costMinor: costMoney.costMinor, usefulLifeMonths: life },
    });

    return NextResponse.json({ _id: res.insertedId, ...doc }, { status: 201 });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/assets error', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
