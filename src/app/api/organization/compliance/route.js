import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { escapeRegex } from '../../../../lib/finance/tx';
import { requireFinanceAdmin, capString, parseLimit } from '../../../../lib/finance/auth';
import { presetRange } from '../../../../lib/finance/dates';
import { recordFinanceAudit, actorFromUser } from '../../../../lib/finance/audit';

// Compliance calendar for statutory filings (GST / TDS / Income Tax / ROC /
// FCRA / PF / ESI). Items are stored in `compliance_items` with status
// 'pending' | 'filed' only — "overdue" is NEVER stored; it is derived at read
// time as (status === 'pending' && dueDate < now) so an item can not get stuck
// overdue after its due date is edited or it is filed late.

// NOTE: route files may only export HTTP handlers, so these are module-local
// (duplicated in the [id] route on purpose).
const COMPLIANCE_TYPES = ['GST', 'TDS', 'IT', 'ROC', 'FCRA', 'PF', 'ESI', 'other'];
const RECURRENCES = ['none', 'monthly', 'quarterly', 'annual'];

/** Derived (read-time) status: 'filed' | 'overdue' | 'pending'. */
function deriveStatus(item, now = new Date()) {
  if (item.status === 'filed') return 'filed';
  const due = item.dueDate ? new Date(item.dueDate) : null;
  if (due && !Number.isNaN(due.getTime()) && due < now) return 'overdue';
  return 'pending';
}

function withDerivedStatus(items, now = new Date()) {
  return items.map((it) => ({ ...it, derivedStatus: deriveStatus(it, now) }));
}

/** Sanitize the attachments array: {name, url} rows, both capped, max 20. */
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

export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('compliance_items');

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status'); // pending | overdue | filed
    const assignedTo = searchParams.get('assignedTo');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const limit = parseLimit(searchParams.get('limit'), { def: 200, max: 1000 });
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10) || 0);

    const now = new Date();

    // ---- Filtered list (soft-deleted rows are always excluded) ----
    const filter = { deletedAt: { $exists: false } };
    if (type && COMPLIANCE_TYPES.includes(type)) filter.type = type;
    if (assignedTo) {
      filter.assignedTo = { $regex: escapeRegex(assignedTo), $options: 'i' };
    }
    const due = {};
    if (startDate) {
      const d = new Date(startDate);
      if (!Number.isNaN(d.getTime())) due.$gte = d;
    }
    if (endDate) {
      const d = new Date(endDate);
      if (!Number.isNaN(d.getTime())) due.$lte = d;
    }
    // Status filter maps to the DERIVED status: 'overdue' = pending & past-due,
    // 'pending' = pending & not yet due, 'filed' = filed.
    if (status === 'filed') {
      filter.status = 'filed';
    } else if (status === 'overdue') {
      filter.status = 'pending';
      due.$lt = now;
    } else if (status === 'pending') {
      filter.status = 'pending';
      if (due.$gte === undefined || due.$gte < now) due.$gte = now;
    }
    if (Object.keys(due).length) filter.dueDate = due;
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { referenceNo: { $regex: safe, $options: 'i' } },
      ];
    }

    // Pending views sort by nearest due date first; the filed view shows the
    // most recently filed first.
    const sort = status === 'filed' ? { filedAt: -1, dueDate: -1 } : { dueDate: 1, _id: 1 };

    const totalCount = await col.countDocuments(filter);
    const rawItems = await col.find(filter).sort(sort).skip(skip).limit(limit).toArray();
    const items = withDerivedStatus(rawItems, now);

    // ---- Header buckets + counts (filter-independent, whole calendar) ----
    // Bucketing choice: the server returns BOTH capped bucket arrays and plain
    // counts. The UI uses `counts` for the summary cards and the filtered
    // `items` list for tab content (tabs map onto the `status` query param);
    // `buckets` are available for dashboard-style consumers.
    const base = { deletedAt: { $exists: false } };
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const yearStart = presetRange('thisYear', now).start; // start of IST year

    const overdueQuery = { ...base, status: 'pending', dueDate: { $lt: now } };
    const upcomingQuery = { ...base, status: 'pending', dueDate: { $gte: now, $lte: in30 } };
    const filedThisYearQuery = { ...base, status: 'filed', filedAt: { $gte: yearStart } };

    const [overdueCount, dueSoonCount, filedThisYearCount, overdueBucket, upcomingBucket, recentlyFiledBucket] =
      await Promise.all([
        col.countDocuments(overdueQuery),
        col.countDocuments(upcomingQuery),
        col.countDocuments(filedThisYearQuery),
        col.find(overdueQuery).sort({ dueDate: 1 }).limit(100).toArray(),
        col.find(upcomingQuery).sort({ dueDate: 1 }).limit(100).toArray(),
        col.find({ ...base, status: 'filed' }).sort({ filedAt: -1 }).limit(10).toArray(),
      ]);

    return NextResponse.json({
      items,
      counts: {
        overdue: overdueCount,
        dueSoon30: dueSoonCount,
        filedThisYear: filedThisYearCount,
      },
      buckets: {
        overdue: withDerivedStatus(overdueBucket, now),
        upcoming: withDerivedStatus(upcomingBucket, now),
        recentlyFiled: withDerivedStatus(recentlyFiledBucket, now),
      },
      pagination: { total: totalCount, skip, limit, returned: items.length },
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/compliance error', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

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

    const client = await clientPromise;
    const db = client.db('resources');

    const doc = {
      title: capString(title, 200),
      type,
      description: capString(description, 2000),
      dueDate: dueDateObj,
      recurrence: resolvedRecurrence,
      status: 'pending', // 'overdue' is derived at read time, never stored
      assignedTo: capString(assignedTo, 200),
      referenceNo: capString(referenceNo, 200),
      notes: capString(notes, 2000),
      attachments: sanitizeAttachments(attachments),
      createdAt: new Date(),
      createdBy: actorFromUser(user),
    };

    const res = await db.collection('compliance_items').insertOne(doc);
    await recordFinanceAudit(db, {
      action: 'compliance.create',
      collection: 'compliance_items',
      documentId: res.insertedId,
      actor: actorFromUser(user),
      after: doc,
      meta: { type: doc.type, recurrence: doc.recurrence },
    });

    return NextResponse.json({ _id: res.insertedId, ...doc, derivedStatus: deriveStatus(doc) }, { status: 201 });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/compliance error', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
