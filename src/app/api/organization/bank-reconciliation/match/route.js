import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { FinanceError } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin } from '../../../../../lib/finance/auth';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';

const BANK_CODE = '1000';
const AUTO_MATCH_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // ±3 days

function financeCatch(e, label) {
  if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
  console.error(label, e);
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}

// Auto-match unreconciled bank_txns to book (GL bank) lines by equal signed
// amount and a date within ±3 days. Each book line is used at most once.
async function autoMatch(db, accountId, actor) {
  const unmatched = await db
    .collection('bank_txns')
    .find({ accountId, reconciled: { $ne: true } })
    .toArray();

  const bookRows = await db
    .collection('journal_entries')
    .aggregate([
      {
        $match: {
          'lines.accountCode': BANK_CODE,
          $or: [{ 'meta.accountId': accountId }, { 'lines.accountId': accountId }],
        },
      },
      { $unwind: '$lines' },
      {
        $match: {
          'lines.accountCode': BANK_CODE,
          $or: [{ 'lines.accountId': accountId }, { 'meta.accountId': accountId }],
        },
      },
      {
        $project: {
          journalId: '$_id',
          date: 1,
          signedMinor: { $subtract: ['$lines.debitMinor', '$lines.creditMinor'] },
        },
      },
    ])
    .toArray();

  const alreadyMatched = await db
    .collection('bank_txns')
    .find({ accountId, matchedJournalId: { $ne: null } }, { projection: { matchedJournalId: 1 } })
    .toArray();
  const usedJournalIds = new Set(alreadyMatched.map((t) => String(t.matchedJournalId)));

  let matched = 0;
  for (const txn of unmatched) {
    const txnTime = new Date(txn.date).getTime();
    const candidate = bookRows.find(
      (b) =>
        !usedJournalIds.has(String(b.journalId)) &&
        b.signedMinor === (txn.amountMinor || 0) &&
        Math.abs(new Date(b.date).getTime() - txnTime) <= AUTO_MATCH_WINDOW_MS
    );
    if (!candidate) continue;
    usedJournalIds.add(String(candidate.journalId));
    await db
      .collection('bank_txns')
      .updateOne(
        { _id: txn._id },
        { $set: { reconciled: true, matchedJournalId: String(candidate.journalId), matchedAt: new Date(), matchedBy: actor } }
      );
    matched += 1;
  }

  await recordFinanceAudit(db, {
    action: 'bankrec.automatch',
    collection: 'bank_txns',
    actor,
    meta: { accountId, matched, scanned: unmatched.length },
  });

  return matched;
}

// POST /api/organization/bank-reconciliation/match
//  - { bankTxnId, journalId }   → mark reconciled
//  - { bankTxnId, unmatch:true } → clear the match
//  - { accountId, auto:true }    → auto-match by amount + near date
export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const client = await clientPromise;
    const db = client.db('resources');
    const actor = actorFromUser(user);

    if (body.auto) {
      const accountId = body.accountId != null ? String(body.accountId) : '';
      if (!accountId) throw new FinanceError('accountId is required for auto-match', 400);
      const matched = await autoMatch(db, accountId, actor);
      return NextResponse.json({ ok: true, matched });
    }

    const bankTxnId = body.bankTxnId != null ? String(body.bankTxnId) : '';
    if (!bankTxnId || !ObjectId.isValid(bankTxnId)) {
      throw new FinanceError('A valid bankTxnId is required', 400);
    }

    const col = db.collection('bank_txns');
    const existing = await col.findOne({ _id: new ObjectId(bankTxnId) });
    if (!existing) return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 });

    let set;
    if (body.unmatch) {
      set = { reconciled: false, matchedJournalId: null, matchedAt: null, matchedBy: null };
    } else {
      const journalId = body.journalId != null ? String(body.journalId) : '';
      if (!journalId || !ObjectId.isValid(journalId)) {
        throw new FinanceError('A valid journalId is required', 400);
      }
      const journal = await db
        .collection('journal_entries')
        .findOne({ _id: new ObjectId(journalId) }, { projection: { _id: 1 } });
      if (!journal) throw new FinanceError('Journal entry not found', 400);
      set = { reconciled: true, matchedJournalId: journalId, matchedAt: new Date(), matchedBy: actor };
    }

    await col.updateOne({ _id: existing._id }, { $set: set });
    const after = { ...existing, ...set };

    await recordFinanceAudit(db, {
      action: 'bankrec.match',
      collection: 'bank_txns',
      documentId: existing._id,
      actor,
      before: existing,
      after,
      meta: { unmatch: !!body.unmatch, matchedJournalId: set.matchedJournalId },
    });

    return NextResponse.json({ ok: true, txn: { _id: String(existing._id), ...set } });
  } catch (e) {
    return financeCatch(e, 'POST /api/organization/bank-reconciliation/match error');
  }
}
