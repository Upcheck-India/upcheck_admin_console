import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { assertAccountExists, FinanceError } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString, capTags } from '../../../../../lib/finance/auth';
import { moneyFields, fromMinor, readMinor, toMinor } from '../../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';

const MAX_LIFE_MONTHS = 600; // 50 years

// ---------------------------------------------------------------------------
// Straight-line depreciation in INTEGER PAISE (same math as the list route):
// monthly = floor((cost - salvage) / life); the final month absorbs the
// rounding remainder so accumulated lands exactly on (cost - salvage) and net
// book value never dips below salvage. Depreciation stops at end of life, and
// at the disposal date for disposed assets.
// ---------------------------------------------------------------------------

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
  const accumulated = months >= life ? depreciable : monthlyMinor * months;
  return {
    monthsElapsed: months,
    accumulatedMinor: accumulated,
    netBookValueMinor: costMinor - accumulated,
    monthlyMinor,
  };
}

/** 'YYYY-MM' label for the k-th month after `start` (pure Y/M arithmetic, no day rollover). */
function monthLabel(start, k) {
  const total = start.getFullYear() * 12 + start.getMonth() + k;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Full month-by-month schedule in rupees. Stops at end of life, or at the
 * disposal month for disposed assets. The final month of life absorbs the
 * integer-paise rounding remainder, so the last row's accumulated equals
 * (cost - salvage) and its netBookValue equals salvage exactly.
 */
function buildSchedule(asset) {
  const costMinor = readMinor(asset, 'cost');
  const salvageMinor = readMinor(asset, 'salvageValue');
  const life = Math.max(1, parseInt(asset.usefulLifeMonths, 10) || 1);
  const start = new Date(asset.purchaseDate);
  if (Number.isNaN(start.getTime())) return [];

  const depreciable = Math.max(0, costMinor - salvageMinor);
  const monthlyMinor = Math.floor(depreciable / life);

  let stop = life;
  if (asset.status === 'disposed' && asset.disposedAt) {
    const end = new Date(asset.disposedAt);
    if (!Number.isNaN(end.getTime())) {
      let m = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      if (m < 0) m = 0;
      stop = Math.min(life, m);
    }
  }

  const rows = [];
  let accumulated = 0;
  for (let k = 1; k <= stop; k++) {
    const dep = k === life ? depreciable - monthlyMinor * (life - 1) : monthlyMinor;
    accumulated += dep;
    rows.push({
      month: monthLabel(start, k),
      depreciation: fromMinor(dep),
      accumulated: fromMinor(accumulated),
      netBookValue: fromMinor(costMinor - accumulated),
    });
  }
  return rows;
}

/** UTC calendar-day string for date equality checks (tolerates time-of-day noise). */
function dayKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function GET(request, { params }) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const asset = await db.collection('fixed_assets').findOne({ _id: new ObjectId(id) });
    if (!asset || asset.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const dep = depreciationAsOf(asset);
    return NextResponse.json({
      ...asset,
      cost: fromMinor(readMinor(asset, 'cost')),
      salvageValue: fromMinor(readMinor(asset, 'salvageValue')),
      monthlyDepreciation: fromMinor(dep.monthlyMinor),
      accumulatedDepreciation: fromMinor(dep.accumulatedMinor),
      netBookValue: fromMinor(dep.netBookValueMinor),
      monthsElapsed: dep.monthsElapsed,
      schedule: buildSchedule(asset),
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/assets/[id] error', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('fixed_assets');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ error: 'Asset has been deleted' }, { status: 409 });

    const body = (await request.json()) || {};

    // ---- Disposed assets: only notes / assignedTo / location may change ----
    // The financial facts of a disposed asset (cost, life, dates…) are frozen;
    // attempting to change any of them is a conflict, not a validation error.
    if (existing.status === 'disposed') {
      const changed = [];
      if (body.name !== undefined && capString(body.name, 200) !== (existing.name || '')) changed.push('name');
      if (body.category !== undefined && (capString(body.category, 100) || 'other') !== (existing.category || 'other')) changed.push('category');
      if (body.accountId !== undefined && String(body.accountId || '') !== String(existing.accountId || '')) changed.push('accountId');
      if (body.serialNumber !== undefined && capString(body.serialNumber, 200) !== (existing.serialNumber || '')) changed.push('serialNumber');
      if (body.purchaseDate !== undefined && dayKey(body.purchaseDate) !== dayKey(existing.purchaseDate)) changed.push('purchaseDate');
      if (body.usefulLifeMonths !== undefined && parseInt(body.usefulLifeMonths, 10) !== existing.usefulLifeMonths) changed.push('usefulLifeMonths');
      if (body.method !== undefined && body.method !== '' && body.method !== existing.method) changed.push('method');
      if (body.cost !== undefined) {
        try { if (toMinor(body.cost) !== readMinor(existing, 'cost')) changed.push('cost'); } catch { changed.push('cost'); }
      }
      if (body.salvageValue !== undefined && body.salvageValue !== '') {
        try { if (toMinor(body.salvageValue) !== readMinor(existing, 'salvageValue')) changed.push('salvageValue'); } catch { changed.push('salvageValue'); }
      }
      if (changed.length) {
        return NextResponse.json(
          { error: `Disposed assets can only have notes, assigned to and location edited (attempted: ${changed.join(', ')})` },
          { status: 409 }
        );
      }

      const updateDoc = { updatedAt: new Date(), updatedBy: actorFromUser(user) };
      if (body.notes !== undefined) updateDoc.notes = capString(body.notes, 2000);
      if (body.assignedTo !== undefined) updateDoc.assignedTo = capString(body.assignedTo, 200);
      if (body.location !== undefined) updateDoc.location = capString(body.location, 200);

      await col.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });
      await recordFinanceAudit(db, {
        action: 'asset.update', collection: 'fixed_assets', documentId: id,
        actor: actorFromUser(user), before: existing, after: { ...existing, ...updateDoc },
        meta: { disposedEdit: true },
      });
      return NextResponse.json({ ...existing, ...updateDoc });
    }

    // ---- Active assets: full edit with the same validation as create ----
    const {
      name, category, accountId, purchaseDate, cost, salvageValue,
      usefulLifeMonths, method, assignedTo, location, serialNumber, notes, tags,
    } = body;

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

    let costMoney;
    let salvageMoney;
    try {
      if (accountId) await assertAccountExists(db, accountId);
      costMoney = moneyFields('cost', cost);
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

    const updateDoc = {
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
      notes: capString(notes, 2000),
      tags: capTags(tags),
      updatedAt: new Date(),
      updatedBy: actorFromUser(user),
    };

    await col.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });
    await recordFinanceAudit(db, {
      action: 'asset.update', collection: 'fixed_assets', documentId: id,
      actor: actorFromUser(user), before: existing, after: { _id: existing._id, ...updateDoc },
      meta: { accountId: updateDoc.accountId, costMinor: costMoney.costMinor, usefulLifeMonths: life },
    });

    return NextResponse.json({ _id: id, ...updateDoc });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('PUT /api/organization/assets/[id] error', e);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    let body = {};
    try {
      body = (await request.json()) || {};
    } catch {
      body = {};
    }
    const dispose = searchParams.get('dispose') === 'true' || body.dispose === true;

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('fixed_assets');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (dispose) {
      // ---- Dispose: freeze depreciation at the disposal date ----
      if (existing.deletedAt) return NextResponse.json({ error: 'Asset has been deleted' }, { status: 409 });
      if (existing.status === 'disposed') {
        return NextResponse.json({ error: 'Asset is already disposed' }, { status: 409 });
      }

      let disposedAt = new Date();
      if (body.disposedAt) {
        disposedAt = new Date(body.disposedAt);
        if (Number.isNaN(disposedAt.getTime())) {
          return NextResponse.json({ error: 'Invalid disposal date' }, { status: 400 });
        }
      }
      const purchase = new Date(existing.purchaseDate);
      if (!Number.isNaN(purchase.getTime()) && disposedAt < purchase) {
        return NextResponse.json({ error: 'Disposal date cannot be before the purchase date' }, { status: 400 });
      }

      const updateDoc = {
        status: 'disposed',
        disposedAt,
        disposalNotes: capString(body.disposalNotes, 2000),
        updatedAt: new Date(),
        updatedBy: actorFromUser(user),
      };
      await col.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });
      await recordFinanceAudit(db, {
        action: 'asset.dispose', collection: 'fixed_assets', documentId: id,
        actor: actorFromUser(user), before: existing, after: { ...existing, ...updateDoc },
        meta: { disposedAt },
      });
      return NextResponse.json({ success: true, id, status: 'disposed', disposedAt });
    }

    // ---- Soft delete: the row is retained (excluded from lists/totals) ----
    if (existing.deletedAt) return NextResponse.json({ success: true, id, alreadyDeleted: true });

    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { deletedAt: new Date(), deletedBy: actorFromUser(user) } }
    );
    await recordFinanceAudit(db, {
      action: 'asset.delete', collection: 'fixed_assets', documentId: id,
      actor: actorFromUser(user), before: existing,
    });

    return NextResponse.json({ success: true, id });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('DELETE /api/organization/assets/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
