import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../../../lib/mongodb';
import { FinanceError, withFinanceTransaction } from '../../../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString } from '../../../../../../../lib/finance/auth';
import { loadAccountIndex, postJournal } from '../../../../../../../lib/finance/gl';
import { recordFinanceAudit, actorFromUser } from '../../../../../../../lib/finance/audit';

function financeCatch(e, label) {
  if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
  console.error(label, e);
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}

// POST /api/organization/gl/journal/[id]/reverse — post a reversing entry that
// flips debits and credits of the original. Idempotent on (source, reference):
// the same original is only reversed once. Body: { date?, description? }.
export async function POST(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid journal id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    const client = await clientPromise;
    const db = client.db('resources');

    const original = await db.collection('journal_entries').findOne({ _id: new ObjectId(id) });
    if (!original) return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    if (original.source === 'reversal' || String(original.reference || '').startsWith('reverse:')) {
      throw new FinanceError('A reversing entry cannot itself be reversed', 400);
    }

    const flipped = (original.lines || []).map((l) => ({
      accountCode: l.accountCode,
      accountId: l.accountId,
      memo: l.memo,
      debitMinor: l.creditMinor || 0,
      creditMinor: l.debitMinor || 0,
    }));

    const actor = actorFromUser(user);
    const entry = await withFinanceTransaction(client, async (session) => {
      const accountIndex = await loadAccountIndex(db, session);
      const { entry: posted, duplicate } = await postJournal(
        db,
        {
          date: body.date || new Date(),
          description: capString(body.description, 1000) || `Reversal of ${original.description || id}`,
          source: 'reversal',
          reference: `reverse:${id}`,
          actor,
          meta: { accountId: original.meta?.accountId || null, reversalOf: String(id) },
          lines: flipped,
        },
        { session, accountIndex }
      );
      if (!duplicate) {
        await recordFinanceAudit(
          db,
          {
            action: 'gl.journal.reverse',
            collection: 'journal_entries',
            documentId: posted._id,
            actor,
            after: posted,
            meta: { reversalOf: String(id) },
          },
          session
        );
      }
      return { posted, duplicate };
    });

    return NextResponse.json(
      { ...entry.posted, alreadyReversed: entry.duplicate },
      { status: entry.duplicate ? 200 : 201 }
    );
  } catch (e) {
    return financeCatch(e, 'POST /api/organization/gl/journal/[id]/reverse error');
  }
}
