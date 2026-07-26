import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { requireFinanceAdmin } from '../../../../../lib/finance/auth';
import { loadAccountIndex } from '../../../../../lib/finance/gl';
import { fromMinor } from '../../../../../lib/finance/money';
import { presetRange } from '../../../../../lib/finance/dates';

// GET /api/organization/gl/trial-balance — the headline GL report.
// Aggregates journal_entries by account, joins the chart for names/types, and
// returns per-account debit/credit/balance plus totals (totalDebit === totalCredit).
// Optional filters: startDate/endDate (or datePreset), accountId (meta.accountId).
export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const datePreset = searchParams.get('datePreset');
    const accountId = searchParams.get('accountId');

    let rangeStart = startDate ? new Date(startDate) : null;
    let rangeEnd = endDate ? new Date(endDate) : null;
    if (!rangeStart && !rangeEnd && datePreset) {
      const r = presetRange(datePreset);
      rangeStart = r.start;
      rangeEnd = r.end;
    }

    const match = {};
    if (rangeStart || rangeEnd) {
      match.date = {};
      if (rangeStart) match.date.$gte = rangeStart;
      if (rangeEnd) match.date.$lte = rangeEnd;
    }
    if (accountId) match['meta.accountId'] = accountId;

    const grouped = await db
      .collection('journal_entries')
      .aggregate([
        { $match: match },
        { $unwind: '$lines' },
        {
          $group: {
            _id: '$lines.accountCode',
            debitMinor: { $sum: '$lines.debitMinor' },
            creditMinor: { $sum: '$lines.creditMinor' },
          },
        },
      ])
      .toArray();

    const index = await loadAccountIndex(db);

    let totalDebitMinor = 0;
    let totalCreditMinor = 0;

    const accounts = grouped
      .map((row) => {
        const acct = index.get(row._id);
        const type = acct?.type || 'unknown';
        const normalBalance = acct?.normalBalance || 'debit';
        const debitMinor = row.debitMinor || 0;
        const creditMinor = row.creditMinor || 0;
        totalDebitMinor += debitMinor;
        totalCreditMinor += creditMinor;
        // Balance signed by the account's normal side.
        const balanceMinor =
          normalBalance === 'debit' ? debitMinor - creditMinor : creditMinor - debitMinor;
        return {
          code: row._id,
          name: acct?.name || `Account ${row._id}`,
          type,
          normalBalance,
          debit: fromMinor(debitMinor),
          credit: fromMinor(creditMinor),
          balance: fromMinor(balanceMinor),
        };
      })
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));

    return NextResponse.json({
      accounts,
      totals: {
        totalDebit: fromMinor(totalDebitMinor),
        totalCredit: fromMinor(totalCreditMinor),
        balanced: totalDebitMinor === totalCreditMinor,
        differenceMinor: totalDebitMinor - totalCreditMinor,
      },
      currency: 'INR',
      range: { start: rangeStart, end: rangeEnd, accountId: accountId || null },
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/gl/trial-balance error', e);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
