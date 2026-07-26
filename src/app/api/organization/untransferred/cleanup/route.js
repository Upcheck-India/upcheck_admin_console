import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { requireFinanceAdmin } from '../../../../../lib/finance/auth';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';

export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');

    const items = await db.collection('org_untransferred').find({ deletedAt: { $exists: false } }).toArray();

    // Cleanup is a NON-DESTRUCTIVE repair. It never deletes records (that would
    // erase the audit trail) and never rewrites remainingAmount UPWARD (that
    // would resurrect already-transferred money — the old behavior, made worse
    // by corrupted history). It only clamps clearly-invalid states downward.
    // Fully-cleared entries (remaining === 0) are already hidden by the list
    // endpoint's `remaining > 0` filter, so there is nothing to "remove".
    let fixedNegative = 0;
    let normalized = 0;

    for (const it of items) {
      const amount = Number(it.amount) || 0;
      const remaining = it.remainingAmount != null ? Number(it.remainingAmount) : amount;

      if (!Number.isFinite(remaining)) {
        // Missing/corrupt remaining — reset to the original amount (never higher).
        await db.collection('org_untransferred').updateOne(
          { _id: it._id },
          { $set: { remainingAmount: amount, updatedAt: new Date() } }
        );
        normalized += 1;
      } else if (remaining < 0) {
        await db.collection('org_untransferred').updateOne(
          { _id: it._id },
          { $set: { remainingAmount: 0, updatedAt: new Date() } }
        );
        fixedNegative += 1;
      } else if (remaining > amount) {
        // remaining can never legitimately exceed the original amount — clamp down.
        await db.collection('org_untransferred').updateOne(
          { _id: it._id },
          { $set: { remainingAmount: amount, updatedAt: new Date() } }
        );
        normalized += 1;
      }
    }

    // Optional: remove dangling references from grant applications
    const allIds = new Set((await db.collection('org_untransferred').find({}, { projection: { _id: 1 } }).toArray()).map((x) => String(x._id)));
    const updateDangling = await db.collection('grant_applications').updateMany(
      { untransferredId: { $exists: true } },
      [
        {
          $set: {
            untransferredId: {
              $cond: [
                { $in: [{ $toString: '$untransferredId' }, Array.from(allIds)] },
                '$untransferredId',
                null,
              ],
            },
          },
        },
      ]
    );

    await recordFinanceAudit(db, {
      action: 'untransferred.cleanup', collection: 'org_untransferred', documentId: null,
      actor: actorFromUser(user), meta: { normalized, fixedNegative, danglingCleared: updateDangling.modifiedCount || 0 },
    });

    return NextResponse.json({ success: true, normalized, fixedNegative, danglingCleared: updateDangling.modifiedCount || 0 });
  } catch (e) {
    console.error('POST /api/organization/untransferred/cleanup error', e);
    return NextResponse.json({ error: 'Failed to cleanup untransferred' }, { status: 500 });
  }
}
