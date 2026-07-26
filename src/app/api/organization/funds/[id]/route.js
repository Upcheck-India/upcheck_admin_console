import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { assertAccountExists, FinanceError } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString, capTags } from '../../../../../lib/finance/auth';
import { moneyFields, fromMinor } from '../../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';
import { normalizeCurrency, assertValidRate, getRate, convertMinor } from '../../../../../lib/finance/currency';
import { fundGlVersion, remirrorEditedFund, postFundReversal } from '../../../../../lib/finance/gl';

/**
 * Resolve currency + frozen FX for a money entry (see funds/route.js for the
 * full rationale). INR → fxRate 1; foreign → client-supplied rate (freezes what
 * the user saw) or a server-fetched rate. Returns the fields stored on the row.
 */
async function resolveFx(db, currencyRaw, clientRate, amountMinor) {
  const currency = normalizeCurrency(currencyRaw);
  if (currency === 'INR') {
    return { currency, fxRate: 1, fxRateDate: null, fxSource: 'identity', inrMinor: amountMinor };
  }
  let fxRate;
  let fxRateDate;
  let fxSource;
  if (clientRate != null && clientRate !== '') {
    fxRate = assertValidRate(clientRate);
    fxRateDate = new Date().toISOString().slice(0, 10);
    fxSource = 'client';
  } else {
    const r = await getRate(currency, 'INR', { db });
    fxRate = r.rate;
    fxRateDate = r.date;
    fxSource = r.source;
  }
  return { currency, fxRate, fxRateDate, fxSource, inrMinor: convertMinor(amountMinor, fxRate) };
}

export async function GET(request, { params }) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const item = await db.collection('org_funds').findOne({ _id: new ObjectId(id) });
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const inrMinor =
      item.inrMinor != null
        ? item.inrMinor
        : item.amountMinor != null
          ? item.amountMinor
          : Math.round((Number(item.amount) || 0) * 100);
    return NextResponse.json({ ...item, currency: item.currency || 'INR', inrMinor, inr: fromMinor(inrMinor) });
  } catch (e) {
    console.error('GET /api/organization/funds/[id] error', e);
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
    const col = db.collection('org_funds');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ error: 'Entry has been deleted' }, { status: 409 });
    // Transfer-generated entries are the ledger side of a pool movement; editing
    // them would desync the untransferred pool. They must be reversed, not edited.
    if (existing.isTransfer) {
      return NextResponse.json({ error: 'Transfer entries are immutable. Reverse the transfer instead.' }, { status: 409 });
    }

    const body = await request.json();
    const { kind, amount, currency, fxRate, title, date, notes, category, source, counterparty, reference, tags, accountId, inflowType, expenseType, fundRestriction, allocations } = body || {};

    if (!['in', 'out'].includes(kind)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    if (!title || typeof title !== 'string') return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

    let money;
    let fx;
    try {
      await assertAccountExists(db, accountId);
      money = moneyFields('amount', amount);
      if (money.amountMinor <= 0) throw new FinanceError('Invalid amount', 400);
      // Re-freeze currency + FX for the edited amount; inrMinor stays canonical.
      fx = await resolveFx(db, currency, fxRate, money.amountMinor);
    } catch (err) {
      if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
      throw err;
    }

    const resolvedInflow = kind === 'in' ? (inflowType || null) : null;
    const resolvedExpense = kind === 'out' ? (expenseType || null) : null;
    const updateDoc = {
      kind,
      ...money,
      currency: fx.currency,
      fxRate: fx.fxRate,
      fxRateDate: fx.fxRateDate,
      fxSource: fx.fxSource,
      inrMinor: fx.inrMinor,
      title: capString(title, 200),
      date: date ? new Date(date) : new Date(),
      notes: capString(notes, 2000),
      category: category || resolvedInflow || resolvedExpense || 'other',
      accountId,
      inflowType: resolvedInflow,
      expenseType: resolvedExpense,
      fundRestriction: kind === 'in' ? (fundRestriction || 'unrestricted') : null,
      allocations: Array.isArray(allocations) ? allocations.filter((a) => a && (a.amount || a.percent)).slice(0, 50) : [],
      source: capString(source, 200),
      counterparty: capString(counterparty, 200),
      reference: capString(reference, 200),
      tags: capTags(tags),
      // Bump the GL mirror version so the edit reverses the prior journal and
      // posts a corrected one (see remirrorEditedFund below).
      glVersion: fundGlVersion(existing) + 1,
      updatedAt: new Date(),
      updatedBy: actorFromUser(user),
    };

    await col.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });
    await recordFinanceAudit(db, {
      action: 'fund.update', collection: 'org_funds', documentId: id,
      actor: actorFromUser(user), before: existing, after: { _id: existing._id, ...updateDoc },
      meta: { accountId, kind, amountMinor: money.amountMinor, currency: fx.currency, fxRate: fx.fxRate, inrMinor: fx.inrMinor },
    });

    // Re-mirror into the GL: reverse the previous version, post the corrected one
    // (best-effort — the idempotent backfill reconciles if this fails).
    try {
      await remirrorEditedFund(db, existing, { _id: existing._id, ...existing, ...updateDoc }, { actor: actorFromUser(user) });
    } catch (glErr) {
      console.error('GL re-mirror deferred to backfill (fund edit):', glErr && glErr.message);
    }

    return NextResponse.json({ _id: id, ...updateDoc });
  } catch (e) {
    console.error('PUT /api/organization/funds/[id] error', e);
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
    const col = db.collection('org_funds');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ success: true, id, alreadyDeleted: true });
    // Protect ledger↔pool consistency: transfer entries can't be soft-deleted here.
    if (existing.isTransfer) {
      return NextResponse.json({ error: 'Transfer entries are immutable. Reverse the transfer instead.' }, { status: 409 });
    }

    // Soft delete — the row is retained (and excluded from all balances) so the
    // financial history is never silently destroyed. Recoverable; also audited.
    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { deletedAt: new Date(), deletedBy: actorFromUser(user) } }
    );
    await recordFinanceAudit(db, {
      action: 'fund.delete', collection: 'org_funds', documentId: id,
      actor: actorFromUser(user), before: existing,
    });

    // Reverse this entry's GL mirror so the ledger reflects the deletion.
    try {
      await postFundReversal(db, existing, { actor: actorFromUser(user) });
    } catch (glErr) {
      console.error('GL reversal deferred to backfill (fund delete):', glErr && glErr.message);
    }

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error('DELETE /api/organization/funds/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
