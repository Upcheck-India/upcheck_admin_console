import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { withFinanceTransaction } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin } from '../../../../../lib/finance/auth';
import { moneyFields, readMinor, fromMinor } from '../../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';
import { postFundJournal } from '../../../../../lib/finance/gl';

export async function DELETE(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const pool = db.collection('org_untransferred');
    const funds = db.collection('org_funds');
    const poolId = new ObjectId(id);

    const found = await pool.findOne({ _id: poolId });
    if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (found.deletedAt) return NextResponse.json({ success: true, id, alreadyDeleted: true });

    const remainingMinor = readMinor(found, 'remainingAmount');
    // The source account is the one the money was originally received FROM.
    const receiveEntry = Array.isArray(found.history)
      ? found.history.find((h) => h && h.type === 'receive_from_account' && h.accountId)
      : null;
    const sourceAccountId = receiveEntry?.accountId || null;
    const opId = `revpool:${id}`;

    const now = new Date();
    const actor = actorFromUser(user);

    await withFinanceTransaction(client, async (session) => {
      // Reverse the unspent remainder back to its source account with a contra
      // entry, so soft-deleting the pool record never makes money vanish.
      if (remainingMinor > 0 && sourceAccountId) {
        const already = await funds.findOne({ opId }, { session, projection: { _id: 1 } });
        if (!already) {
          await funds.insertOne(
            {
              kind: 'in',
              ...moneyFields('amount', fromMinor(remainingMinor)),
              title: `Reversal: ${found.title || 'untransferred'}`,
              date: now,
              notes: 'Unassigned remainder returned to source account on deletion of untransferred entry',
              category: 'other',
              accountId: sourceAccountId,
              inflowType: null,
              expenseType: null,
              allocations: [],
              source: found.source || '',
              counterparty: '',
              reference: `untransferred:${id}`,
              tags: ['transfer', 'reversal'],
              opId,
              isTransfer: true,
              createdAt: now,
              createdBy: actor,
            },
            { session }
          );
        }
      }

      // Soft-delete the pool record (retain history for audit/reconciliation).
      await pool.updateOne(
        { _id: poolId },
        { $set: { deletedAt: now, deletedBy: actor, remainingAmount: 0, remainingAmountMinor: 0 } },
        { session }
      );

      // Clear dangling references from any grant application.
      await db.collection('grant_applications').updateMany(
        { untransferredId: id },
        { $unset: { untransferredId: '' } },
        { session }
      );

      await recordFinanceAudit(
        db,
        {
          action: 'untransferred.delete',
          collection: 'org_untransferred',
          documentId: id,
          actor,
          before: found,
          meta: { reversedMinor: remainingMinor > 0 && sourceAccountId ? remainingMinor : 0, sourceAccountId },
        },
        session
      );
    });

    // Mirror the contra (reversal) entry into the GL, if one was posted.
    try {
      const glFund = await funds.findOne({ opId });
      if (glFund) await postFundJournal(db, glFund, { actor });
    } catch (glErr) {
      console.error('GL mirror deferred to backfill (pool reversal opId):', glErr && glErr.message);
    }

    return NextResponse.json({
      success: true,
      id,
      reversed: remainingMinor > 0 && sourceAccountId ? fromMinor(remainingMinor) : 0,
      warning: remainingMinor > 0 && !sourceAccountId ? 'Remaining balance could not be auto-reversed (unknown source account).' : undefined,
    });
  } catch (e) {
    console.error('DELETE /api/organization/untransferred/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
