import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { requireFinanceAdmin } from '../../../../lib/finance/auth';
import { minorExpr, fromMinor } from '../../../../lib/finance/money';
import { presetRange, groupIdForBucket } from '../../../../lib/finance/dates';

// GET /api/organization/reports
// Financial reports for one billing account: P&L by inflow/expense type,
// monthly cashflow, and restricted vs unrestricted fund utilization.
//
// Query params:
//   accountId        (required)
//   datePreset       today|last7|thisWeek|thisMonth|last30|thisQuarter|thisYear
//   startDate/endDate  explicit range (wins over datePreset)
//   excludeTransfers   default true; pass excludeTransfers=false to include
//                      inter-account transfer entries in the report.
export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    // Transfers are excluded by default so inter-account movements don't
    // inflate income/expenses; excludeTransfers=false opts back in.
    const excludeTransfers = searchParams.get('excludeTransfers') !== 'false';

    // Effective date range — explicit start/end wins; otherwise resolve the
    // preset in the business timezone (IST) so period boundaries line up with
    // the monthly buckets below. Default period: this year.
    const now = new Date();
    let preset = searchParams.get('datePreset') || null;
    let rangeStart = startDate ? new Date(startDate) : null;
    let rangeEnd = endDate ? new Date(endDate) : null;
    if ((rangeStart && Number.isNaN(rangeStart.getTime())) || (rangeEnd && Number.isNaN(rangeEnd.getTime()))) {
      return NextResponse.json({ error: 'Invalid startDate/endDate' }, { status: 400 });
    }
    if (rangeStart || rangeEnd) {
      preset = 'custom';
    } else {
      if (!preset) preset = 'thisYear';
      let r = presetRange(preset, now);
      if (!r.start && !r.end) {
        preset = 'thisYear';
        r = presetRange(preset, now);
      }
      rangeStart = r.start;
      rangeEnd = r.end;
    }

    // Base match applied to EVERY facet: account scope, soft-delete exclusion,
    // period bounds, and (by default) transfer exclusion.
    const match = { accountId, deletedAt: { $exists: false } };
    if (excludeTransfers) match.isTransfer = { $ne: true };
    if (rangeStart || rangeEnd) {
      match.date = {};
      if (rangeStart) match.date.$gte = rangeStart;
      if (rangeEnd) match.date.$lte = rangeEnd;
    }

    const receivedMinorSum = { $sum: { $cond: [{ $eq: ['$kind', 'in'] }, minorExpr('amount'), 0] } };
    const spentMinorSum = { $sum: { $cond: [{ $eq: ['$kind', 'out'] }, minorExpr('amount'), 0] } };

    const [agg] = await db.collection('org_funds').aggregate([
      { $match: match },
      { $facet: {
        // P&L: income grouped by inflowType, expenses by expenseType. All sums
        // are integer paise via minorExpr (legacy-doc tolerant).
        income: [
          { $match: { kind: 'in' } },
          { $group: { _id: { $ifNull: ['$inflowType', 'other'] }, totalMinor: { $sum: minorExpr('amount') } } },
          { $sort: { totalMinor: -1 } },
        ],
        expenses: [
          { $match: { kind: 'out' } },
          { $group: { _id: { $ifNull: ['$expenseType', 'other'] }, totalMinor: { $sum: minorExpr('amount') } } },
          { $sort: { totalMinor: -1 } },
        ],
        // Monthly cashflow, bucketed in IST so months match the preset bounds.
        cashflow: [
          { $group: {
            _id: groupIdForBucket('month'),
            receivedMinor: receivedMinorSum,
            spentMinor: spentMinorSum,
          } },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ],
        // Fund utilization: 'restricted' vs everything else. Entries without a
        // fundRestriction (legacy docs and all expense entries) default to
        // unrestricted.
        restriction: [
          { $group: {
            _id: { $cond: [{ $eq: ['$fundRestriction', 'restricted'] }, 'restricted', 'unrestricted'] },
            receivedMinor: receivedMinorSum,
            spentMinor: spentMinorSum,
          } },
        ],
      } },
    ]).toArray();

    const income = (agg?.income || []).map((r) => ({ type: r._id || 'other', total: fromMinor(r.totalMinor) }));
    const expenses = (agg?.expenses || []).map((r) => ({ type: r._id || 'other', total: fromMinor(r.totalMinor) }));
    const totalIncomeMinor = (agg?.income || []).reduce((s, r) => s + (r.totalMinor || 0), 0);
    const totalExpensesMinor = (agg?.expenses || []).reduce((s, r) => s + (r.totalMinor || 0), 0);

    const cashflow = (agg?.cashflow || []).map((b) => ({
      year: b._id.year,
      month: b._id.month,
      received: fromMinor(b.receivedMinor),
      spent: fromMinor(b.spentMinor),
      net: fromMinor((b.receivedMinor || 0) - (b.spentMinor || 0)),
    }));

    const fundUtilization = {
      restricted: { received: 0, spent: 0, balance: 0 },
      unrestricted: { received: 0, spent: 0, balance: 0 },
    };
    for (const row of agg?.restriction || []) {
      const key = row._id === 'restricted' ? 'restricted' : 'unrestricted';
      fundUtilization[key] = {
        received: fromMinor(row.receivedMinor),
        spent: fromMinor(row.spentMinor),
        balance: fromMinor((row.receivedMinor || 0) - (row.spentMinor || 0)),
      };
    }

    return NextResponse.json({
      period: { start: rangeStart, end: rangeEnd, preset },
      pnl: {
        income,
        totalIncome: fromMinor(totalIncomeMinor),
        expenses,
        totalExpenses: fromMinor(totalExpensesMinor),
        net: fromMinor(totalIncomeMinor - totalExpensesMinor),
      },
      cashflow,
      fundUtilization,
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/reports error', e);
    return NextResponse.json({ error: 'Failed to build report' }, { status: 500 });
  }
}
