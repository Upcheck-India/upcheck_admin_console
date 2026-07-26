import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { assertAccountExists, FinanceError } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString } from '../../../../../lib/finance/auth';
import { moneyFields } from '../../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';
import { FREQUENCIES, initialDueDate } from '../_recur';

// Lifecycle: active <-> paused, and either -> cancelled (terminal). A cancelled
// subscription is read-only; un-cancelling is not allowed.
const ALLOWED_NEXT = {
  active: ['active', 'paused', 'cancelled'],
  paused: ['paused', 'active', 'cancelled'],
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
    const item = await db.collection('vendor_subscriptions').findOne({ _id: new ObjectId(id) });
    if (!item || item.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let vendorName = '';
    let vendorStatus = 'active';
    if (item.vendorId && ObjectId.isValid(item.vendorId)) {
      const vendor = await db.collection('vendors').findOne(
        { _id: new ObjectId(item.vendorId) },
        { projection: { name: 1, status: 1 } }
      );
      vendorName = vendor?.name || '';
      vendorStatus = vendor?.status || 'active';
    }
    return NextResponse.json({ ...item, vendorName, vendorStatus });
  } catch (e) {
    console.error('GET /api/organization/vendor-subscriptions/[id] error', e);
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
    const col = db.collection('vendor_subscriptions');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing || existing.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status === 'cancelled') {
      return NextResponse.json({ error: 'Cancelled subscriptions cannot be edited' }, { status: 409 });
    }

    const body = await request.json();
    const set = { updatedAt: new Date(), updatedBy: actorFromUser(user) };

    // Status transition guard.
    let nextStatus = existing.status;
    if (body?.status != null) {
      nextStatus = String(body.status);
      const allowed = ALLOWED_NEXT[existing.status] || [];
      if (!allowed.includes(nextStatus)) {
        return NextResponse.json(
          { error: `Cannot change status from '${existing.status}' to '${nextStatus}'` },
          { status: 409 }
        );
      }
      set.status = nextStatus;
    }

    // Editable descriptive/scheduling fields.
    if (body?.description !== undefined) set.description = capString(body.description, 2000);
    if (body?.expenseType !== undefined) set.expenseType = capString(body.expenseType, 60) || null;
    if (body?.autoApprove !== undefined) set.autoApprove = body.autoApprove === true;

    if (body?.dueInDays !== undefined && body.dueInDays !== '') {
      const n = parseInt(body.dueInDays, 10);
      if (!Number.isInteger(n) || n < 0) return NextResponse.json({ error: 'dueInDays must be an integer >= 0' }, { status: 400 });
      set.dueInDays = n;
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

    // Schedule-shaping fields. anchorDay/frequency/startDate only re-seed
    // nextDueDate when the sub has not started generating yet (generatedCount 0);
    // otherwise the running schedule is preserved to avoid retroactive shifts.
    let newFrequency = existing.frequency;
    if (body?.frequency !== undefined) {
      newFrequency = String(body.frequency);
      if (!FREQUENCIES.includes(newFrequency)) return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 });
      set.frequency = newFrequency;
    }
    let newAnchorDay = existing.anchorDay ?? null;
    if (body?.anchorDay !== undefined) {
      if (body.anchorDay === '' || body.anchorDay === null) {
        newAnchorDay = null;
      } else {
        const a = parseInt(body.anchorDay, 10);
        if (!Number.isInteger(a) || a < 1 || a > 31) return NextResponse.json({ error: 'anchorDay must be 1-31' }, { status: 400 });
        newAnchorDay = a;
      }
      set.anchorDay = newAnchorDay;
    }
    let newStartDate = existing.startDate;
    if (body?.startDate !== undefined && body.startDate) {
      const d = new Date(body.startDate);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 });
      newStartDate = d;
      set.startDate = d;
    }
    if (body?.endDate !== undefined) {
      if (!body.endDate) {
        set.endDate = null;
      } else {
        const d = new Date(body.endDate);
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 });
        if (d < newStartDate) return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 });
        set.endDate = d;
      }
    }

    const scheduleChanged = body?.frequency !== undefined || body?.anchorDay !== undefined || body?.startDate !== undefined;
    if (scheduleChanged && (existing.generatedCount || 0) === 0) {
      if (newFrequency === 'weekly') newAnchorDay = null;
      set.nextDueDate = initialDueDate(newStartDate, newFrequency, newAnchorDay);
    }

    await col.updateOne({ _id: new ObjectId(id) }, { $set: set });
    await recordFinanceAudit(db, {
      action: 'subscription.update', collection: 'vendor_subscriptions', documentId: id,
      actor: actorFromUser(user), before: existing, after: { ...existing, ...set },
      meta: { statusFrom: existing.status, statusTo: nextStatus },
    });

    return NextResponse.json({ ...existing, ...set, _id: id });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('PUT /api/organization/vendor-subscriptions/[id] error', e);
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
    const col = db.collection('vendor_subscriptions');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ success: true, id, alreadyDeleted: true });

    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { deletedAt: new Date(), deletedBy: actorFromUser(user) } }
    );
    await recordFinanceAudit(db, {
      action: 'subscription.delete', collection: 'vendor_subscriptions', documentId: id,
      actor: actorFromUser(user), before: existing,
    });

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error('DELETE /api/organization/vendor-subscriptions/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
