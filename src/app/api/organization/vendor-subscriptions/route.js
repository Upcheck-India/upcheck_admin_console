import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../lib/mongodb';
import { assertAccountExists, FinanceError } from '../../../../lib/finance/tx';
import { requireFinanceAdmin, capString, parseLimit } from '../../../../lib/finance/auth';
import { moneyFields } from '../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../lib/finance/audit';
import { FREQUENCIES, initialDueDate } from './_recur';

const SUB_STATUSES = ['active', 'paused', 'cancelled'];

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
    const limit = parseLimit(searchParams.get('limit'), { def: 200, max: 1000 });
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10) || 0);

    const filter = { deletedAt: { $exists: false } };
    if (vendorId) filter.vendorId = vendorId;
    if (accountId) filter.accountId = accountId;
    if (status && SUB_STATUSES.includes(status)) filter.status = status;

    const col = db.collection('vendor_subscriptions');
    const totalCount = await col.countDocuments(filter);

    const items = await col.aggregate([
      { $match: filter },
      { $sort: { nextDueDate: 1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'vendors',
          let: { vid: { $convert: { input: '$vendorId', to: 'objectId', onError: null, onNull: null } } },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$vid'] } } },
            { $project: { name: 1, status: 1 } },
          ],
          as: 'vendor',
        },
      },
      {
        $addFields: {
          vendorName: { $ifNull: [{ $arrayElemAt: ['$vendor.name', 0] }, ''] },
          vendorStatus: { $ifNull: [{ $arrayElemAt: ['$vendor.status', 0] }, 'active'] },
        },
      },
      { $project: { vendor: 0 } },
    ]).toArray();

    // Cheap "how many are due now" count for the generate button badge.
    const dueCount = await col.countDocuments({
      deletedAt: { $exists: false },
      status: 'active',
      nextDueDate: { $lte: new Date() },
      ...(accountId ? { accountId } : {}),
      ...(vendorId ? { vendorId } : {}),
    });

    return NextResponse.json({
      items,
      dueCount,
      pagination: { total: totalCount, skip, limit, returned: items.length },
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/vendor-subscriptions error', e);
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

    const frequency = String(body?.frequency || '');
    if (!FREQUENCIES.includes(frequency)) {
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 });
    }

    // anchorDay (day-of-month) only applies to monthly+; ignored for weekly.
    let anchorDay = null;
    if (body?.anchorDay != null && body.anchorDay !== '') {
      anchorDay = parseInt(body.anchorDay, 10);
      if (!Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31) {
        return NextResponse.json({ error: 'anchorDay must be 1-31' }, { status: 400 });
      }
    }
    if (frequency === 'weekly') anchorDay = null;

    const startDate = body?.startDate ? new Date(body.startDate) : new Date();
    if (Number.isNaN(startDate.getTime())) return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 });
    let endDate = null;
    if (body?.endDate) {
      endDate = new Date(body.endDate);
      if (Number.isNaN(endDate.getTime())) return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 });
      if (endDate < startDate) return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 });
    }

    let dueInDays = 0;
    if (body?.dueInDays != null && body.dueInDays !== '') {
      dueInDays = parseInt(body.dueInDays, 10);
      if (!Number.isInteger(dueInDays) || dueInDays < 0) {
        return NextResponse.json({ error: 'dueInDays must be an integer >= 0' }, { status: 400 });
      }
    }

    const client = await clientPromise;
    const db = client.db('resources');

    let money;
    try {
      await assertAccountExists(db, accountId);
      money = moneyFields('amount', body?.amount);
      if (money.amountMinor <= 0) throw new FinanceError('Invalid amount', 400);
    } catch (err) {
      if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
      throw err;
    }

    const vendor = await db.collection('vendors').findOne(
      { _id: new ObjectId(vendorId) },
      { projection: { name: 1, deletedAt: 1, status: 1 } }
    );
    if (!vendor || vendor.deletedAt) return NextResponse.json({ error: 'Vendor not found' }, { status: 400 });

    const nextDueDate = initialDueDate(startDate, frequency, anchorDay);

    const doc = {
      vendorId,
      accountId,
      description: capString(body?.description, 2000),
      ...money,
      currency: 'INR',
      expenseType: capString(body?.expenseType, 60) || null,
      frequency,
      anchorDay,
      startDate,
      nextDueDate,
      endDate,
      status: 'active',
      autoApprove: body?.autoApprove === true,
      dueInDays,
      generatedCount: 0,
      createdAt: new Date(),
      createdBy: actorFromUser(user),
    };

    const res = await db.collection('vendor_subscriptions').insertOne(doc);
    await recordFinanceAudit(db, {
      action: 'subscription.create', collection: 'vendor_subscriptions', documentId: res.insertedId,
      actor: actorFromUser(user), after: doc,
      meta: { vendorId, accountId, amountMinor: money.amountMinor, frequency },
    });

    const warning = (vendor.status || 'active') === 'suspended' ? 'Vendor is suspended; bills will not generate until reactivated' : undefined;
    return NextResponse.json({ _id: res.insertedId, ...doc, vendorName: vendor.name || '', warning }, { status: 201 });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/vendor-subscriptions error', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
