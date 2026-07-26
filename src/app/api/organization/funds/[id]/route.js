import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { assertAccountExists, FinanceError } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString, capTags } from '../../../../../lib/finance/auth';
import { moneyFields } from '../../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';

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
    return NextResponse.json(item);
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
    const { kind, amount, title, date, notes, category, source, counterparty, reference, tags, accountId, inflowType, expenseType, fundRestriction, allocations } = body || {};

    if (!['in', 'out'].includes(kind)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    if (!title || typeof title !== 'string') return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

    let money;
    try {
      await assertAccountExists(db, accountId);
      money = moneyFields('amount', amount);
      if (money.amountMinor <= 0) throw new FinanceError('Invalid amount', 400);
    } catch (err) {
      if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
      throw err;
    }

    const resolvedInflow = kind === 'in' ? (inflowType || null) : null;
    const resolvedExpense = kind === 'out' ? (expenseType || null) : null;
    const updateDoc = {
      kind,
      ...money,
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
      updatedAt: new Date(),
      updatedBy: actorFromUser(user),
    };

    await col.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });
    await recordFinanceAudit(db, {
      action: 'fund.update', collection: 'org_funds', documentId: id,
      actor: actorFromUser(user), before: existing, after: { _id: existing._id, ...updateDoc },
    });

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

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error('DELETE /api/organization/funds/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
