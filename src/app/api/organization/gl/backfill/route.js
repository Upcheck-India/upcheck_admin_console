import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { requireFinanceAdmin, parseLimit } from '../../../../../lib/finance/auth';
import { seedChartOfAccounts, postFundJournal, postFundReversal } from '../../../../../lib/finance/gl';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';

// POST /api/organization/gl/backfill — idempotently mirror the existing org_funds
// cashbook into the GL. Safe to re-run: postFundJournal is idempotent on
// (source 'org_funds', reference = fund _id), so already-posted rows are counted
// as `alreadyPresent`, never double-posted.
export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const limit = parseLimit(body.limit, { def: 1000, max: 5000 });
    const includeReversals = body.includeReversals !== false; // default on

    const client = await clientPromise;
    const db = client.db('resources');
    const actor = actorFromUser(user);

    // Ensure the chart exists before any posting resolves account codes.
    await seedChartOfAccounts(db);

    let posted = 0;
    let skipped = 0;
    let alreadyPresent = 0;
    let processed = 0;

    // Live rows → forward postings. Bounded by `limit`; sorted oldest-first so a
    // partial run always covers a contiguous prefix of history.
    const liveCursor = db
      .collection('org_funds')
      .find({ deletedAt: { $exists: false } })
      .sort({ date: 1, _id: 1 })
      .limit(limit);

    for await (const fund of liveCursor) {
      processed += 1;
      const r = await postFundJournal(db, fund, { actor });
      if (r.skipped) skipped += 1;
      else if (r.duplicate) alreadyPresent += 1;
      else posted += 1;
    }

    // Soft-deleted rows → reversing postings (optional).
    let reversed = 0;
    let reversalsAlreadyPresent = 0;
    if (includeReversals) {
      const deletedCursor = db
        .collection('org_funds')
        .find({ deletedAt: { $exists: true } })
        .sort({ deletedAt: 1, _id: 1 })
        .limit(limit);

      for await (const fund of deletedCursor) {
        const r = await postFundReversal(db, fund, { actor });
        if (r.skipped) skipped += 1;
        else if (r.duplicate) reversalsAlreadyPresent += 1;
        else reversed += 1;
      }
    }

    const result = { posted, skipped, alreadyPresent, reversed, reversalsAlreadyPresent, processed, limit };

    await recordFinanceAudit(db, {
      action: 'gl.backfill',
      collection: 'journal_entries',
      actor,
      meta: result,
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/gl/backfill error', e);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}
