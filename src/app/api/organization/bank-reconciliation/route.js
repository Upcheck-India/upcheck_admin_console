import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { requireFinanceAdmin } from '../../../../lib/finance/auth';
import { fromMinor } from '../../../../lib/finance/money';
import { presetRange } from '../../../../lib/finance/dates';

const BANK_CODE = '1000';

// GET /api/organization/bank-reconciliation?accountId=...&startDate=&endDate=
// Returns the two reconciliation sides plus a summary.
//  - book side: GL Bank (1000) lines tagged to this billing account
//  - bank side: bank_txns imported for this account
export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const datePreset = searchParams.get('datePreset');

    let rangeStart = startDate ? new Date(startDate) : null;
    let rangeEnd = endDate ? new Date(endDate) : null;
    if (!rangeStart && !rangeEnd && datePreset) {
      const r = presetRange(datePreset);
      rangeStart = r.start;
      rangeEnd = r.end;
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const dateFilter = {};
    if (rangeStart) dateFilter.$gte = rangeStart;
    if (rangeEnd) dateFilter.$lte = rangeEnd;
    const hasDate = Object.keys(dateFilter).length > 0;

    // ---- Book side: bank (1000) lines belonging to this account ----
    const entryMatch = {
      'lines.accountCode': BANK_CODE,
      $or: [{ 'meta.accountId': accountId }, { 'lines.accountId': accountId }],
    };
    if (hasDate) entryMatch.date = dateFilter;

    const bookRows = await db
      .collection('journal_entries')
      .aggregate([
        { $match: entryMatch },
        { $unwind: '$lines' },
        {
          $match: {
            'lines.accountCode': BANK_CODE,
            $or: [{ 'lines.accountId': accountId }, { 'meta.accountId': accountId }],
          },
        },
        {
          $project: {
            _id: 0,
            journalId: '$_id',
            date: 1,
            description: 1,
            source: 1,
            debitMinor: '$lines.debitMinor',
            creditMinor: '$lines.creditMinor',
            memo: '$lines.memo',
          },
        },
        { $sort: { date: -1 } },
      ])
      .toArray();

    // Which journals are already matched to a bank line?
    const matchedTxns = await db
      .collection('bank_txns')
      .find({ accountId, matchedJournalId: { $ne: null } }, { projection: { matchedJournalId: 1 } })
      .toArray();
    const matchedJournalIds = new Set(matchedTxns.map((t) => String(t.matchedJournalId)));

    let bookBalanceMinor = 0;
    let unreconciledBookCount = 0;
    const book = bookRows.map((r) => {
      const debitMinor = r.debitMinor || 0;
      const creditMinor = r.creditMinor || 0;
      bookBalanceMinor += debitMinor - creditMinor;
      const reconciled = matchedJournalIds.has(String(r.journalId));
      if (!reconciled) unreconciledBookCount += 1;
      return {
        journalId: String(r.journalId),
        date: r.date,
        description: r.description,
        source: r.source,
        memo: r.memo || null,
        debit: fromMinor(debitMinor),
        credit: fromMinor(creditMinor),
        reconciled,
      };
    });

    // ---- Bank side: imported statement lines ----
    const bankMatch = { accountId };
    if (hasDate) bankMatch.date = dateFilter;
    const bankTxns = await db.collection('bank_txns').find(bankMatch).sort({ date: -1 }).toArray();

    let statementBalanceMinor = 0;
    let unreconciledBankCount = 0;
    const bank = bankTxns.map((t) => {
      const amountMinor = t.amountMinor || 0;
      statementBalanceMinor += amountMinor;
      if (!t.reconciled) unreconciledBankCount += 1;
      return {
        _id: String(t._id),
        statementId: t.statementId ? String(t.statementId) : null,
        date: t.date,
        description: t.description,
        amount: fromMinor(amountMinor),
        reconciled: !!t.reconciled,
        matchedJournalId: t.matchedJournalId ? String(t.matchedJournalId) : null,
      };
    });

    const differenceMinor = bookBalanceMinor - statementBalanceMinor;

    return NextResponse.json({
      accountId,
      book,
      bank,
      summary: {
        bookBalance: fromMinor(bookBalanceMinor),
        statementBalance: fromMinor(statementBalanceMinor),
        difference: fromMinor(differenceMinor),
        unreconciledBookCount,
        unreconciledBankCount,
        reconciled: differenceMinor === 0,
      },
      currency: 'INR',
      range: { start: rangeStart, end: rangeEnd },
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/bank-reconciliation error', e);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
