import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { assertAccountExists, FinanceError } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString } from '../../../../../lib/finance/auth';
import { moneyFields } from '../../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';

// Lifecycle: draft -> approved -> paid (only via the /pay route) or cancelled.
// Paid bills are immutable; cancelled bills are terminal.
const ALLOWED_NEXT = {
  draft: ['draft', 'approved', 'cancelled'],
  approved: ['approved', 'cancelled'],
  cancelled: ['cancelled'],
};

export async function GET(request, { params }) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const item = await db.collection('vendor_bills').findOne({ _id: new ObjectId(id) });
    if (!item || item.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let vendorName = '';
    if (item.vendorId && ObjectId.isValid(item.vendorId)) {
      const vendor = await db.collection('vendors').findOne(
        { _id: new ObjectId(item.vendorId) },
        { projection: { name: 1 } }
      );
      vendorName = vendor?.name || '';
    }
    return NextResponse.json({ ...item, vendorName });
  } catch (e) {
    console.error('GET /api/organization/vendor-bills/[id] error', e);
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
    const col = db.collection('vendor_bills');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing || existing.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status === 'paid') {
      return NextResponse.json({ error: 'Paid bills cannot be edited' }, { status: 409 });
    }

    const body = await request.json();

    // Status transition guard. Paying happens only through the /pay route so
    // the org_funds outflow and the bill flip stay atomic.
    let nextStatus = existing.status;
    if (body?.status != null) {
      nextStatus = String(body.status);
      if (nextStatus === 'paid') {
        return NextResponse.json({ error: 'Use the pay action to mark a bill paid' }, { status: 409 });
      }
      const allowed = ALLOWED_NEXT[existing.status] || [];
      if (!allowed.includes(nextStatus)) {
        return NextResponse.json(
          { error: `Cannot change status from '${existing.status}' to '${nextStatus}'` },
          { status: 409 }
        );
      }
    }

    const set = { status: nextStatus, updatedAt: new Date(), updatedBy: actorFromUser(user) };

    if (body?.billNumber !== undefined) set.billNumber = capString(body.billNumber, 100);
    if (body?.description !== undefined) set.description = capString(body.description, 2000);
    if (body?.expenseType !== undefined) set.expenseType = capString(body.expenseType, 60) || null;
    if (body?.billDate !== undefined && body.billDate) {
      const d = new Date(body.billDate);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid billDate' }, { status: 400 });
      set.billDate = d;
    }
    if (body?.dueDate !== undefined) {
      if (!body.dueDate) {
        set.dueDate = null;
      } else {
        const d = new Date(body.dueDate);
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 });
        set.dueDate = d;
      }
    }

    try {
      if (body?.amount !== undefined) {
        const money = moneyFields('amount', body.amount);
        if (money.amountMinor <= 0) throw new FinanceError('Invalid amount', 400);
        set.amount = money.amount;
        set.amountMinor = money.amountMinor;
      }
      if (body?.accountId !== undefined && body.accountId && body.accountId !== existing.accountId) {
        await assertAccountExists(db, body.accountId);
        set.accountId = String(body.accountId);
      }
    } catch (err) {
      if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
      throw err;
    }

    await col.updateOne({ _id: new ObjectId(id) }, { $set: set });
    await recordFinanceAudit(db, {
      action: 'bill.update', collection: 'vendor_bills', documentId: id,
      actor: actorFromUser(user), before: existing, after: { ...existing, ...set },
      meta: { statusFrom: existing.status, statusTo: nextStatus },
    });

    return NextResponse.json({ ...existing, ...set, _id: id });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('PUT /api/organization/vendor-bills/[id] error', e);
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
    const col = db.collection('vendor_bills');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ success: true, id, alreadyDeleted: true });
    if (existing.status === 'paid') {
      // A paid bill has a matching org_funds outflow; deleting it would orphan
      // the ledger entry and understate spend history.
      return NextResponse.json({ error: 'Paid bills cannot be deleted' }, { status: 409 });
    }

    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { deletedAt: new Date(), deletedBy: actorFromUser(user) } }
    );
    await recordFinanceAudit(db, {
      action: 'bill.delete', collection: 'vendor_bills', documentId: id,
      actor: actorFromUser(user), before: existing,
    });

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error('DELETE /api/organization/vendor-bills/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
