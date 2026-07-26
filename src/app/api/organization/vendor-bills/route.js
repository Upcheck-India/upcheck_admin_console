import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../lib/mongodb';
import { escapeRegex, assertAccountExists, FinanceError } from '../../../../lib/finance/tx';
import { requireFinanceAdmin, capString, parseLimit } from '../../../../lib/finance/auth';
import { moneyFields, minorExpr, fromMinor } from '../../../../lib/finance/money';
import { presetRange } from '../../../../lib/finance/dates';
import { recordFinanceAudit, actorFromUser } from '../../../../lib/finance/audit';

// Route files may only export HTTP handlers/config, so keep this module-local.
const BILL_STATUSES = ['draft', 'approved', 'paid', 'cancelled'];

export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');

    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId');
    const accountId = searchParams.get('accountId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = parseLimit(searchParams.get('limit'), { def: 200, max: 1000 });
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10) || 0);

    // Base scope (vendor/account) — the summary uses this WITHOUT the status
    // facet so the AP cards stay stable while the user flips status filters.
    const baseMatch = { deletedAt: { $exists: false } };
    if (vendorId) baseMatch.vendorId = vendorId;
    if (accountId) baseMatch.accountId = accountId;

    const filter = { ...baseMatch };
    if (status && BILL_STATUSES.includes(status)) filter.status = status;
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { billNumber: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
      ];
    }

    const col = db.collection('vendor_bills');
    const totalCount = await col.countDocuments(filter);

    // List page, enriched with the vendor's name for display.
    const items = await col.aggregate([
      { $match: filter },
      { $sort: { billDate: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'vendors',
          let: { vid: { $convert: { input: '$vendorId', to: 'objectId', onError: null, onNull: null } } },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$vid'] } } },
            { $project: { name: 1 } },
          ],
          as: 'vendor',
        },
      },
      { $addFields: { vendorName: { $ifNull: [{ $arrayElemAt: ['$vendor.name', 0] }, ''] } } },
      { $project: { vendor: 0 } },
    ]).toArray();

    // AP summary — all money summed in paise via minorExpr, returned as rupees.
    const now = new Date();
    const monthStart = presetRange('thisMonth', now).start;
    const isApproved = { $eq: ['$status', 'approved'] };
    const isOverdue = { $and: [isApproved, { $ne: ['$dueDate', null] }, { $lt: ['$dueDate', now] }] };
    const isPaidThisMonth = { $and: [{ $eq: ['$status', 'paid'] }, { $ne: ['$paidAt', null] }, { $gte: ['$paidAt', monthStart] }] };
    const sumAgg = await col.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          outstandingMinor: { $sum: { $cond: [isApproved, minorExpr('amount'), 0] } },
          outstandingCount: { $sum: { $cond: [isApproved, 1, 0] } },
          overdueMinor: { $sum: { $cond: [isOverdue, minorExpr('amount'), 0] } },
          overdueCount: { $sum: { $cond: [isOverdue, 1, 0] } },
          paidThisMonthMinor: { $sum: { $cond: [isPaidThisMonth, minorExpr('amount'), 0] } },
          paidThisMonthCount: { $sum: { $cond: [isPaidThisMonth, 1, 0] } },
          draftCount: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
          cancelledCount: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        },
      },
    ]).toArray();
    const s = sumAgg[0] || {};
    const summary = {
      totalOutstanding: fromMinor(s.outstandingMinor || 0),
      outstandingCount: s.outstandingCount || 0,
      totalOverdue: fromMinor(s.overdueMinor || 0),
      overdueCount: s.overdueCount || 0,
      paidThisMonth: fromMinor(s.paidThisMonthMinor || 0),
      paidThisMonthCount: s.paidThisMonthCount || 0,
      draftCount: s.draftCount || 0,
      paidCount: s.paidCount || 0,
      cancelledCount: s.cancelledCount || 0,
    };

    return NextResponse.json({
      items,
      summary,
      pagination: { total: totalCount, skip, limit, returned: items.length },
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/vendor-bills error', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json();
    const vendorId = capString(body?.vendorId, 40);
    if (!vendorId || !ObjectId.isValid(vendorId)) {
      return NextResponse.json({ error: 'A valid vendorId is required' }, { status: 400 });
    }
    const accountId = capString(body?.accountId, 40);
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

    const status = body?.status ? String(body.status) : 'draft';
    if (!['draft', 'approved'].includes(status)) {
      return NextResponse.json({ error: 'New bills must be draft or approved' }, { status: 400 });
    }

    const billDate = body?.billDate ? new Date(body.billDate) : new Date();
    if (Number.isNaN(billDate.getTime())) return NextResponse.json({ error: 'Invalid billDate' }, { status: 400 });
    let dueDate = null;
    if (body?.dueDate) {
      dueDate = new Date(body.dueDate);
      if (Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    let money;
    try {
      await assertAccountExists(db, accountId);
      money = moneyFields('amount', body?.amount); // validates & rounds to paise
      if (money.amountMinor <= 0) throw new FinanceError('Invalid amount', 400);
    } catch (err) {
      if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
      throw err;
    }

    const vendor = await db.collection('vendors').findOne(
      { _id: new ObjectId(vendorId) },
      { projection: { name: 1, deletedAt: 1 } }
    );
    if (!vendor || vendor.deletedAt) return NextResponse.json({ error: 'Vendor not found' }, { status: 400 });

    const doc = {
      vendorId,
      accountId,
      billNumber: capString(body?.billNumber, 100),
      description: capString(body?.description, 2000),
      ...money,
      billDate,
      dueDate,
      status,
      expenseType: capString(body?.expenseType, 60) || null,
      createdAt: new Date(),
      createdBy: actorFromUser(user),
    };

    const res = await db.collection('vendor_bills').insertOne(doc);
    await recordFinanceAudit(db, {
      action: 'bill.create', collection: 'vendor_bills', documentId: res.insertedId,
      actor: actorFromUser(user), after: doc,
      meta: { vendorId, accountId, amountMinor: money.amountMinor, status },
    });

    return NextResponse.json({ _id: res.insertedId, ...doc, vendorName: vendor.name || '' }, { status: 201 });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/vendor-bills error', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
