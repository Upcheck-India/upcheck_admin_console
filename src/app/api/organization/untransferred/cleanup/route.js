import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';

async function getUserFromToken(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, username: 1, role: 1 } }
    );
    return user;
  } catch {
    return null;
  }
}

function isAdminLike(user) {
  return user && (user.role === 'Admin' || user.role === 'Console admin');
}

export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const client = await clientPromise;
    const db = client.db('resources');

    const items = await db.collection('org_untransferred').find({}).toArray();

    let fixedNegative = 0;
    let normalized = 0;
    let removedZero = 0;
    let removedCleared = 0;

    for (const it of items) {
      const amount = Number(it.amount) || 0;
      const history = it.history || [];
      const transferred = history
        .filter((h) => h && typeof h.amount === 'number' && (h.type?.includes('transfer') || h.type === 'transfer_to_account'))
        .reduce((s, h) => s + (h.amount || 0), 0);
      let remaining = it.remainingAmount != null ? Number(it.remainingAmount) : amount;
      const expectedRemaining = Math.max(0, amount - transferred);

      // Normalize remaining to expected
      if (remaining !== expectedRemaining) {
        await db.collection('org_untransferred').updateOne({ _id: it._id }, { $set: { remainingAmount: expectedRemaining } });
        normalized += 1;
        remaining = expectedRemaining;
      }

      // Fix negative remains
      if (remaining < 0) {
        await db.collection('org_untransferred').updateOne({ _id: it._id }, { $set: { remainingAmount: 0 } });
        fixedNegative += 1;
        remaining = 0;
      }

      // Remove entries that have zero amount and zero remaining and no meaningful history
      if ((amount <= 0 || Number.isNaN(amount)) && remaining === 0 && history.length === 0) {
        await db.collection('org_untransferred').deleteOne({ _id: it._id });
        removedZero += 1;
      }

      // Remove fully cleared entries (remaining 0) to avoid polluting totals
      if (remaining === 0) {
        await db.collection('org_untransferred').deleteOne({ _id: it._id });
        removedCleared += 1;
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

    return NextResponse.json({ success: true, normalized, fixedNegative, removedZero, removedCleared, danglingCleared: updateDangling.modifiedCount || 0 });
  } catch (e) {
    console.error('POST /api/organization/untransferred/cleanup error', e);
    return NextResponse.json({ error: 'Failed to cleanup untransferred' }, { status: 500 });
  }
}
