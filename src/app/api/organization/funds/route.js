import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { escapeRegex, assertAccountExists, FinanceError } from '../../../../lib/finance/tx';
import { requireFinanceAdmin, capString, capTags, parseLimit } from '../../../../lib/finance/auth';
import { moneyFields, minorExpr, fromMinor } from '../../../../lib/finance/money';
import { presetRange, groupIdForBucket } from '../../../../lib/finance/dates';
import { recordFinanceAudit, actorFromUser } from '../../../../lib/finance/audit';

export async function GET(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request);
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');
    const kind = searchParams.get('kind');
    const search = searchParams.get('search');
    const limit = parseLimit(searchParams.get('limit'), { def: 500, max: 2000 });
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10) || 0);
    const groupBy = searchParams.get('groupBy') || 'month';
    const datePreset = searchParams.get('datePreset') || null;
    const accountId = searchParams.get('accountId');
    const inflowType = searchParams.get('inflowType');
    const expenseType = searchParams.get('expenseType');
    const excludeTransfers = searchParams.get('excludeTransfers') === 'true';

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Effective date range — presets are resolved in the business timezone (IST)
    // so period boundaries line up with the aggregation buckets below.
    let rangeStart = startDate ? new Date(startDate) : null;
    let rangeEnd = endDate ? new Date(endDate) : null;
    const now = new Date();
    if (!rangeStart && !rangeEnd && datePreset) {
      const r = presetRange(datePreset, now);
      rangeStart = r.start;
      rangeEnd = r.end;
    }

    // ---- List filter (respects date range + all facets) ----
    // `deletedAt: { $exists: false }` excludes soft-deleted entries from lists
    // and every aggregation below, so computed balances stay correct.
    const filter = { accountId, deletedAt: { $exists: false } };
    if (excludeTransfers) filter.isTransfer = { $ne: true };
    if (rangeStart || rangeEnd) {
      filter.date = {};
      if (rangeStart) filter.date.$gte = rangeStart;
      if (rangeEnd) filter.date.$lte = rangeEnd;
    }
    if (category) filter.category = category;
    if (kind) filter.kind = kind;
    if (inflowType) filter.inflowType = inflowType;
    if (expenseType) filter.expenseType = expenseType;
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { notes: { $regex: safe, $options: 'i' } },
      ];
    }

    const col = db.collection('org_funds');
    const totalCount = await col.countDocuments(filter);
    const items = await col.find(filter).sort({ date: -1 }).skip(skip).limit(limit).toArray();

    // ---- Period activity (received/spent for the selected window) ----
    const summaryAgg = await col.aggregate([
      { $match: filter },
      { $group: { _id: null,
        receivedMinor: { $sum: { $cond: [{ $eq: ['$kind', 'in'] }, minorExpr('amount'), 0] } },
        spentMinor: { $sum: { $cond: [{ $eq: ['$kind', 'out'] }, minorExpr('amount'), 0] } },
      } },
    ]).toArray();
    const periodReceivedMinor = summaryAgg[0]?.receivedMinor || 0;
    const periodSpentMinor = summaryAgg[0]?.spentMinor || 0;

    // ---- Cumulative account balance (all-time, filter-independent) ----
    const balanceMatch = { accountId, deletedAt: { $exists: false } };
    if (excludeTransfers) balanceMatch.isTransfer = { $ne: true };
    const balanceAgg = await col.aggregate([
      { $match: balanceMatch },
      { $group: { _id: null,
        inMinor: { $sum: { $cond: [{ $eq: ['$kind', 'in'] }, minorExpr('amount'), 0] } },
        outMinor: { $sum: { $cond: [{ $eq: ['$kind', 'out'] }, minorExpr('amount'), 0] } },
      } },
    ]).toArray();
    const balanceMinor = (balanceAgg[0]?.inMinor || 0) - (balanceAgg[0]?.outMinor || 0);

    // ---- Average monthly burn over the last 3 complete IST months → runway ----
    const three = presetRange('thisMonth', now).start; // start of current IST month
    const burnStart = new Date(three);
    burnStart.setMonth(burnStart.getMonth() - 3);
    const burnAgg = await col.aggregate([
      { $match: { accountId, kind: 'out', isTransfer: { $ne: true }, deletedAt: { $exists: false }, date: { $gte: burnStart, $lt: three } } },
      { $group: { _id: groupIdForBucket('month'), total: { $sum: minorExpr('amount') } } },
    ]).toArray();
    const avgMonthlyBurnMinor = burnAgg.length ? Math.round(burnAgg.reduce((s, b) => s + b.total, 0) / burnAgg.length) : 0;
    const runwayMonths = balanceMinor > 0 && avgMonthlyBurnMinor > 0 ? Math.floor(balanceMinor / avgMonthlyBurnMinor) : null;

    const summary = {
      received: fromMinor(periodReceivedMinor),
      spent: fromMinor(periodSpentMinor),
      balance: fromMinor(balanceMinor),
      avgMonthlyBurn: fromMinor(avgMonthlyBurnMinor),
      runwayMonths,
    };

    // ---- Category breakdown (period, account-scoped) ----
    const categoryBreakdown = (await col.aggregate([
      { $match: filter },
      { $group: {
        _id: { group: { $ifNull: ['$inflowType', { $ifNull: ['$expenseType', '$category'] }] }, kind: '$kind' },
        totalMinor: { $sum: minorExpr('amount') },
        count: { $sum: 1 },
      } },
      { $sort: { totalMinor: -1 } },
    ]).toArray()).map((c) => ({ _id: c._id, total: fromMinor(c.totalMinor), count: c.count }));

    // ---- Time trends (scoped to account + active facets, grouped in IST) ----
    const trendMatch = { accountId, deletedAt: { $exists: false } };
    if (excludeTransfers) trendMatch.isTransfer = { $ne: true };
    if (category) trendMatch.category = category;
    if (kind) trendMatch.kind = kind;
    if (inflowType) trendMatch.inflowType = inflowType;
    if (expenseType) trendMatch.expenseType = expenseType;
    if (search) {
      const safe = escapeRegex(search);
      trendMatch.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { notes: { $regex: safe, $options: 'i' } },
      ];
    }
    if (rangeStart || rangeEnd) {
      trendMatch.date = {};
      if (rangeStart) trendMatch.date.$gte = rangeStart;
      if (rangeEnd) trendMatch.date.$lte = rangeEnd;
    } else {
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      trendMatch.date = { $gte: twelveMonthsAgo };
    }

    const timeTrends = (await col.aggregate([
      { $match: trendMatch },
      { $group: { _id: groupIdForBucket(groupBy, '$date', { kind: '$kind' }), totalMinor: { $sum: minorExpr('amount') } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.isoWeekYear': 1, '_id.isoWeek': 1 } },
    ]).toArray()).map((t) => ({ _id: t._id, total: fromMinor(t.totalMinor) }));

    return NextResponse.json({
      items,
      summary,
      categoryBreakdown,
      monthlyTrends: timeTrends,
      timeTrends,
      pagination: { total: totalCount, skip, limit, returned: items.length },
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/funds error', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json();
    const { kind, amount, title, date, notes, category, source, counterparty, reference, tags, accountId, inflowType, expenseType, fundRestriction, allocations, isTransfer } = body || {};

    if (!['in', 'out'].includes(kind)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    if (!title || typeof title !== 'string') return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');

    let money;
    try {
      await assertAccountExists(db, accountId);
      money = moneyFields('amount', amount); // validates & rounds to paise
      if (money.amountMinor <= 0) throw new FinanceError('Invalid amount', 400);
    } catch (err) {
      if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
      throw err;
    }

    const resolvedInflow = kind === 'in' ? (inflowType || null) : null;
    const resolvedExpense = kind === 'out' ? (expenseType || null) : null;
    const doc = {
      kind,
      ...money,
      title: capString(title, 200),
      date: date ? new Date(date) : new Date(),
      notes: capString(notes, 2000),
      // Default category from the real type so the category facet isn't dead.
      category: category || resolvedInflow || resolvedExpense || 'other',
      accountId,
      inflowType: resolvedInflow,
      expenseType: resolvedExpense,
      fundRestriction: kind === 'in' ? (fundRestriction || 'unrestricted') : undefined,
      allocations: Array.isArray(allocations) ? allocations.filter((a) => a && (a.amount || a.percent)).slice(0, 50) : [],
      source: capString(source, 200),
      counterparty: capString(counterparty, 200),
      reference: capString(reference, 200),
      tags: capTags(tags),
      isTransfer: isTransfer === true,
      createdAt: new Date(),
      createdBy: actorFromUser(user),
    };

    const res = await db.collection('org_funds').insertOne(doc);
    await recordFinanceAudit(db, {
      action: 'fund.create', collection: 'org_funds', documentId: res.insertedId,
      actor: actorFromUser(user), after: doc, meta: { accountId, kind, amountMinor: money.amountMinor },
    });

    return NextResponse.json({ _id: res.insertedId, ...doc }, { status: 201 });
  } catch (e) {
    console.error('POST /api/organization/funds error', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
