import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { requireFinanceAdmin, capString } from '../../../../../lib/finance/auth';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';

const COMPLIANCE_TYPES = ['GST', 'TDS', 'IT', 'ROC', 'FCRA', 'PF', 'ESI', 'other'];
const RECURRENCES = ['none', 'monthly', 'quarterly', 'annual'];

function deriveStatus(item, now = new Date()) {
  if (item.status === 'filed') return 'filed';
  const due = item.dueDate ? new Date(item.dueDate) : null;
  if (due && !Number.isNaN(due.getTime()) && due < now) return 'overdue';
  return 'pending';
}

function sanitizeAttachments(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const a of input) {
    if (!a || typeof a !== 'object') continue;
    const name = capString(a.name, 200);
    const url = capString(a.url, 1000);
    if (!name && !url) continue;
    out.push({ name, url });
    if (out.length >= 20) break;
  }
  return out;
}

export async function GET(request, { params }) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const item = await db
      .collection('compliance_items')
      .findOne({ _id: new ObjectId(id), deletedAt: { $exists: false } });
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ...item, derivedStatus: deriveStatus(item) });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/compliance/[id] error', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('compliance_items');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ error: 'Item has been deleted' }, { status: 409 });

    const body = await request.json();
    const { title, type, description, dueDate, recurrence, assignedTo, referenceNo, notes, attachments } = body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!COMPLIANCE_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    const dueDateObj = dueDate ? new Date(dueDate) : null;
    if (!dueDateObj || Number.isNaN(dueDateObj.getTime())) {
      return NextResponse.json({ error: 'A valid dueDate is required' }, { status: 400 });
    }
    const resolvedRecurrence = recurrence == null || recurrence === '' ? 'none' : recurrence;
    if (!RECURRENCES.includes(resolvedRecurrence)) {
      return NextResponse.json({ error: 'Invalid recurrence' }, { status: 400 });
    }

    // Filing state (status / filedAt / filedBy) is NEVER writable through the
    // standard edit — it can only change via the dedicated "mark filed" route,
    // so the filing audit trail cannot be forged by an ordinary update.
    const updateDoc = {
      title: capString(title, 200),
      type,
      description: capString(description, 2000),
      dueDate: dueDateObj,
      recurrence: resolvedRecurrence,
      assignedTo: capString(assignedTo, 200),
      referenceNo: capString(referenceNo, 200),
      notes: capString(notes, 2000),
      attachments: sanitizeAttachments(attachments),
      updatedAt: new Date(),
      updatedBy: actorFromUser(user),
    };

    await col.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });
    const after = { ...existing, ...updateDoc };
    await recordFinanceAudit(db, {
      action: 'compliance.update',
      collection: 'compliance_items',
      documentId: id,
      actor: actorFromUser(user),
      before: existing,
      after,
    });

    return NextResponse.json({ ...after, derivedStatus: deriveStatus(after) });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('PUT /api/organization/compliance/[id] error', e);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('compliance_items');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ success: true, id, alreadyDeleted: true });

    // Soft delete — the row is retained (and excluded from all reads) so the
    // compliance history is never silently destroyed. Recoverable; audited.
    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { deletedAt: new Date(), deletedBy: actorFromUser(user) } }
    );
    await recordFinanceAudit(db, {
      action: 'compliance.delete',
      collection: 'compliance_items',
      documentId: id,
      actor: actorFromUser(user),
      before: existing,
    });

    return NextResponse.json({ success: true, id });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('DELETE /api/organization/compliance/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
