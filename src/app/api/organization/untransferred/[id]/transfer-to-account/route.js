import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { withFinanceTransaction, FinanceError, assertAccountExists } from '../../../../../../lib/finance/tx';
import { requireFinanceAdmin } from '../../../../../../lib/finance/auth';
import { toMinor, moneyFields, fromMinor } from '../../../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../../../lib/finance/audit';

export async function POST(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const { accountId, amount, date, notes, inflowType, opId } = body || {};
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    if (!opId || typeof opId !== 'string') return NextResponse.json({ error: 'opId is required' }, { status: 400 });

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
    const poolId = new ObjectId(id);

    const now = new Date();
    const actor = actorFromUser(user);
    const by = { id: actor.id, username: actor.username };

    const result = await withFinanceTransaction(client, async (session) => {
      await assertAccountExists(db, accountId, session);

      const pending = await pool.findOne(
        { _id: poolId },
        { session, projection: { title: 1, source: 1, remainingAmount: 1, deletedAt: 1 } }
      );
      if (!pending || pending.deletedAt) throw new FinanceError('Not found', 404);

      const buildFundsDoc = () => ({
        kind: 'in',
        ...moneyFields('amount', amt),
        title: `Transfer: ${pending.title || 'untransferred'}`,
        date: date ? new Date(date) : now,
        notes: notes || `Transfer from untransferred pool (${pending.source || 'unknown'})`,
        category: 'other',
        accountId,
        inflowType: inflowType || null,
        expenseType: null,
        fundRestriction: 'unrestricted',
        allocations: [],
        source: pending.source || '',
        counterparty: '',
        reference: `untransferred:${id}`,
        tags: ['transfer'],
        opId,
        isTransfer: true,
        createdAt: now,
        createdBy: actor,
      });

      // Idempotency / replay guard keyed on the pool's own history.
      const already = await pool.findOne(
        { _id: poolId, 'history.opId': opId },
        { session, projection: { remainingAmount: 1 } }
      );
      if (already) {
        const led = await funds.findOne({ opId }, { session, projection: { _id: 1 } });
        if (!led) await funds.insertOne(buildFundsDoc(), { session });
        return { replay: true, remaining: already.remainingAmount };
      }

      // Atomic guarded decrement (paise-accurate), single history entry.
      const entry = { type: 'transfer_to_account', accountId, amount: amt, amountMinor: amtMinor, at: now, opId, by };
      const updated = await pool.findOneAndUpdate(
        { _id: poolId, remainingAmount: { $gte: amt } },
        {
          $inc: { remainingAmount: -amt, remainingAmountMinor: -amtMinor },
          $set: { updatedAt: now },
          $push: { history: entry },
        },
        { session, returnDocument: 'after' }
      );
      const updatedDoc = updated && updated.value !== undefined ? updated.value : updated;
      if (!updatedDoc) throw new FinanceError('Amount exceeds remaining balance', 400);

      const fundsDoc = buildFundsDoc();
      const ins = await funds.insertOne(fundsDoc, { session });
      await recordFinanceAudit(
        db,
        {
          action: 'transfer.post', collection: 'org_funds', documentId: ins.insertedId,
          actor, meta: { untransferredId: id, accountId, amountMinor: amtMinor, opId },
        },
        session
      );

      return { replay: false, remaining: updatedDoc.remainingAmount };
    });

    return NextResponse.json({ success: true, remaining: result.remaining, replay: !!result.replay });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/untransferred/[id]/transfer-to-account error', e);
    return NextResponse.json({ error: 'Failed to transfer' }, { status: 500 });
  }
}
