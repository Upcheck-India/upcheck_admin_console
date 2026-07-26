import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../../lib/mongodb';
import { withFinanceTransaction, FinanceError } from '../../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString } from '../../../../../../lib/finance/auth';
import { readMinor, fromMinor } from '../../../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../../../lib/finance/audit';
import { postFundJournal } from '../../../../../../lib/finance/gl';

// Pay an approved vendor bill: atomically flip the bill to 'paid' and post the
// matching outflow to the org_funds ledger. Idempotent on the client-supplied
// opId (org_funds carries a unique sparse index on opId), mirroring the replay
// pattern used by untransferred/[id]/transfer-to-account.
export async function POST(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const { opId, date, notes } = body || {};
    if (!opId || typeof opId !== 'string') return NextResponse.json({ error: 'opId is required' }, { status: 400 });

    let payDate = date ? new Date(date) : null;
    if (payDate && Number.isNaN(payDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const bills = db.collection('vendor_bills');
    const funds = db.collection('org_funds');
    const billId = new ObjectId(id);

    const now = new Date();
    if (!payDate) payDate = now;
    const actor = actorFromUser(user);
    const notesStr = capString(notes, 2000);

    const result = await withFinanceTransaction(client, async (session) => {
      const bill = await bills.findOne({ _id: billId }, { session });
      if (!bill || bill.deletedAt) throw new FinanceError('Not found', 404);

      const amountMinor = readMinor(bill, 'amount');
      if (amountMinor <= 0) throw new FinanceError('Bill has no payable amount', 400);

      let vendorName = '';
      if (bill.vendorId && ObjectId.isValid(bill.vendorId)) {
        const vendor = await db.collection('vendors').findOne(
          { _id: new ObjectId(bill.vendorId) },
          { session, projection: { name: 1 } }
        );
        vendorName = vendor?.name || '';
      }

      const buildFundsDoc = () => ({
        kind: 'out',
        amount: fromMinor(amountMinor),
        amountMinor,
        title: `Bill payment: ${bill.billNumber || vendorName || 'vendor bill'}`,
        date: payDate,
        notes: notesStr || `Payment of vendor bill ${bill.billNumber || id}`,
        category: bill.expenseType || 'other',
        accountId: bill.accountId,
        inflowType: null,
        expenseType: bill.expenseType || null,
        allocations: [],
        source: '',
        counterparty: vendorName,
        reference: `vendorbill:${id}`,
        tags: ['ap'],
        opId,
        isTransfer: false,
        createdAt: now,
        createdBy: actor,
      });

      // Ensure exactly one ledger entry exists for this opId. The unique
      // sparse index on org_funds.opId is the hard backstop for races.
      const ensureLedgerEntry = async () => {
        const led = await funds.findOne({ opId }, { session, projection: { _id: 1 } });
        if (led) return led._id;
        try {
          const ins = await funds.insertOne(buildFundsDoc(), { session });
          return ins.insertedId;
        } catch (err) {
          if (err && err.code === 11000) {
            const again = await funds.findOne({ opId }, { session, projection: { _id: 1 } });
            if (again) return again._id;
          }
          throw err;
        }
      };

      // Idempotent replay: same opId retried after a crash/timeout. Heal a
      // missing ledger entry, never post the outflow twice.
      if (bill.status === 'paid') {
        if (bill.opId === opId) {
          const ledgerId = await ensureLedgerEntry();
          if (!bill.paidFundId && ledgerId) {
            await bills.updateOne({ _id: billId }, { $set: { paidFundId: String(ledgerId) } }, session ? { session } : undefined);
          }
          return { replay: true, paidFundId: bill.paidFundId || (ledgerId ? String(ledgerId) : null) };
        }
        throw new FinanceError('Bill is already paid', 409);
      }
      if (bill.status !== 'approved') {
        throw new FinanceError(`Only approved bills can be paid (status: ${bill.status})`, 409);
      }

      // Atomic claim: only one request can flip approved -> paid. A loser of
      // this race re-checks for a same-opId replay before failing.
      const claimed = await bills.findOneAndUpdate(
        { _id: billId, status: 'approved', deletedAt: { $exists: false } },
        { $set: { status: 'paid', paidAt: payDate, opId, updatedAt: now, updatedBy: actor } },
        { session, returnDocument: 'after' }
      );
      const claimedDoc = claimed && claimed.value !== undefined ? claimed.value : claimed;
      if (!claimedDoc) {
        const latest = await bills.findOne({ _id: billId }, { session, projection: { status: 1, opId: 1, paidFundId: 1 } });
        if (latest && latest.status === 'paid' && latest.opId === opId) {
          const ledgerId = await ensureLedgerEntry();
          return { replay: true, paidFundId: latest.paidFundId || (ledgerId ? String(ledgerId) : null) };
        }
        throw new FinanceError('Bill is no longer payable', 409);
      }

      const ledgerId = await ensureLedgerEntry();
      await bills.updateOne(
        { _id: billId },
        { $set: { paidFundId: String(ledgerId) } },
        session ? { session } : undefined
      );

      await recordFinanceAudit(
        db,
        {
          action: 'bill.pay', collection: 'vendor_bills', documentId: id,
          actor, meta: { opId, amountMinor, accountId: bill.accountId, paidFundId: String(ledgerId) },
        },
        session
      );

      return { replay: false, paidFundId: String(ledgerId) };
    });

    // Mirror the AP payment outflow into the GL (best-effort, post-commit).
    try {
      const glFund = await funds.findOne({ opId });
      if (glFund) await postFundJournal(db, glFund, { actor });
    } catch (glErr) {
      console.error('GL mirror deferred to backfill (bill pay opId):', glErr && glErr.message);
    }

    return NextResponse.json({ success: true, paidFundId: result.paidFundId, replay: !!result.replay });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/vendor-bills/[id]/pay error', e);
    return NextResponse.json({ error: 'Failed to pay bill' }, { status: 500 });
  }
}
