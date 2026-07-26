import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { withFinanceTransaction, FinanceError, assertAccountExists } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString } from '../../../../../lib/finance/auth';
import { toMinor, moneyFields, fromMinor } from '../../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';
import { postFundJournal } from '../../../../../lib/finance/gl';

export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json();
    const { accountId, amount, date, title, notes, opId } = body || {};
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    if (!opId || typeof opId !== 'string') return NextResponse.json({ error: 'opId is required' }, { status: 400 });
    const cleanTitle = capString(title, 200);
    if (!cleanTitle) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    let amtMinor;
    try {
      amtMinor = toMinor(amount);
      if (amtMinor <= 0) throw new FinanceError('Valid amount is required', 400);
    } catch (err) {
      if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
      throw err;
    }
    const amt = fromMinor(amtMinor);

    const client = await clientPromise;
    const db = client.db('resources');
    const funds = db.collection('org_funds');
    const pool = db.collection('org_untransferred');

    const now = new Date();
    const when = date ? new Date(date) : now;
    const actor = actorFromUser(user);

    const fundsDoc = {
      kind: 'out',
      ...moneyFields('amount', amt),
      title: `Move to Untransferred: ${cleanTitle}`,
      date: when,
      notes: capString(notes, 2000) || 'Moved from billing account to untransferred pool',
      category: 'other',
      accountId,
      inflowType: null,
      expenseType: null,
      allocations: [],
      source: '',
      counterparty: '',
      reference: 'untransferred:receive',
      tags: ['transfer'],
      opId,
      isTransfer: true,
      createdAt: now,
      createdBy: actor,
    };

    const buildPoolDoc = () => ({
      ...moneyFields('amount', amt),
      remainingAmount: amt,
      remainingAmountMinor: amtMinor,
      title: cleanTitle,
      source: 'Internal move',
      notes: capString(notes, 2000),
      receivedAt: when,
      relatedApplicationId: null,
      opId,
      history: [{ type: 'receive_from_account', accountId, amount: amt, amountMinor: amtMinor, at: now, opId, by: { id: actor.id, username: actor.username } }],
      createdAt: now,
      createdBy: actor,
    });

    const result = await withFinanceTransaction(client, async (session) => {
      const poolExisting = await pool.findOne({ opId }, { session });
      if (poolExisting) {
        const led = await funds.findOne({ opId }, { session, projection: { _id: 1 } });
        if (!led) await funds.insertOne(fundsDoc, { session });
        return { replay: true, item: poolExisting };
      }

      await assertAccountExists(db, accountId, session);

      const ledExisting = await funds.findOne({ opId }, { session, projection: { _id: 1 } });
      if (!ledExisting) await funds.insertOne(fundsDoc, { session });

      const doc = buildPoolDoc();
      const res = await pool.insertOne(doc, { session });
      await recordFinanceAudit(
        db,
        {
          action: 'receive.post', collection: 'org_untransferred', documentId: res.insertedId,
          actor, meta: { accountId, amountMinor: amtMinor, opId },
        },
        session
      );
      return { replay: false, item: { _id: res.insertedId, ...doc } };
    });

    // Mirror the cashbook entry into the double-entry GL (best-effort, post-commit).
    try {
      const glFund = await funds.findOne({ opId });
      if (glFund) await postFundJournal(db, glFund, { actor });
    } catch (glErr) {
      console.error('GL mirror deferred to backfill (receive opId):', glErr && glErr.message);
    }

    return NextResponse.json(result.item, { status: result.replay ? 200 : 201 });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/untransferred/receive-from-account error', e);
    return NextResponse.json({ error: 'Failed to receive from account' }, { status: 500 });
  }
}
