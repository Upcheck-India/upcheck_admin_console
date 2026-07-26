import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../../lib/mongodb';
import { requireFinanceAdmin, capString } from '../../../../../../lib/finance/auth';
import { recordFinanceAudit, actorFromUser } from '../../../../../../lib/finance/audit';

// POST /api/organization/compliance/[id]/file — mark a compliance item as
// filed. This is the ONLY way status/filedAt/filedBy change (the standard PUT
// never touches them). For recurring items the next occurrence is auto-created
// as a fresh pending item so the calendar rolls forward by itself.

const RECURRENCE_MONTHS = { monthly: 1, quarterly: 3, annual: 12 };

/**
 * Pure helper: add `n` calendar months to a date, clamping day overflow
 * (e.g. Jan 31 + 1 month → Feb 28/29, not Mar 2/3). Time-of-day is preserved.
 */
function addCalendarMonths(due, n) {
  const d = new Date(due);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, max));
  return d;
}

export async function POST(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const { referenceNo, notes, filedAt } = body || {};

    let filedAtDate = new Date();
    if (filedAt != null && filedAt !== '') {
      const d = new Date(filedAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Invalid filedAt date' }, { status: 400 });
      }
      filedAtDate = d;
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('compliance_items');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ error: 'Item has been deleted' }, { status: 409 });
    if (existing.status === 'filed') {
      return NextResponse.json({ error: 'Item is already filed' }, { status: 409 });
    }

    const actor = actorFromUser(user);
    const set = {
      status: 'filed',
      filedAt: filedAtDate,
      filedBy: actor,
      updatedAt: new Date(),
      updatedBy: actor,
    };
    if (typeof referenceNo === 'string' && referenceNo.trim()) set.referenceNo = capString(referenceNo, 200);
    if (typeof notes === 'string' && notes.trim()) set.notes = capString(notes, 2000);

    // Atomic guard on status so two concurrent "mark filed" calls can't both
    // succeed (and can't create two next occurrences).
    const upd = await col.updateOne(
      { _id: new ObjectId(id), status: { $ne: 'filed' }, deletedAt: { $exists: false } },
      { $set: set }
    );
    if (upd.matchedCount === 0) {
      return NextResponse.json({ error: 'Item is already filed' }, { status: 409 });
    }

    // Roll the calendar forward: recurring items spawn their next occurrence
    // as a fresh pending copy with the due date advanced by the recurrence
    // interval (calendar months, day-overflow clamped).
    let nextOccurrence = null;
    const months = RECURRENCE_MONTHS[existing.recurrence];
    if (months) {
      const nextDoc = {
        title: existing.title,
        type: existing.type,
        description: existing.description || '',
        dueDate: addCalendarMonths(existing.dueDate, months),
        recurrence: existing.recurrence,
        status: 'pending',
        assignedTo: existing.assignedTo || '',
        referenceNo: '',
        notes: '',
        attachments: [],
        createdAt: new Date(),
        createdBy: actor,
      };
      const ins = await col.insertOne(nextDoc);
      nextOccurrence = { _id: ins.insertedId, ...nextDoc, derivedStatus: 'pending' };
    }

    const after = { ...existing, ...set };
    await recordFinanceAudit(db, {
      action: 'compliance.file',
      collection: 'compliance_items',
      documentId: id,
      actor,
      before: existing,
      after,
      meta: {
        recurrence: existing.recurrence || 'none',
        nextOccurrenceId: nextOccurrence ? String(nextOccurrence._id) : null,
      },
    });
    if (nextOccurrence) {
      await recordFinanceAudit(db, {
        action: 'compliance.create',
        collection: 'compliance_items',
        documentId: nextOccurrence._id,
        actor,
        after: nextOccurrence,
        meta: { autoCreated: true, rolledFrom: id },
      });
    }

    return NextResponse.json({
      item: { ...after, derivedStatus: 'filed' },
      nextOccurrence,
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/compliance/[id]/file error', e);
    return NextResponse.json({ error: 'Failed to mark filed' }, { status: 500 });
  }
}
