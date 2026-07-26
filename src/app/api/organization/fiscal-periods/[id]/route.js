import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { FinanceError } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin } from '../../../../../lib/finance/auth';
import { monthlyPeriodsForFY, fyStartForDate } from '../../../../../lib/finance/periods';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';

function financeCatch(e, label) {
  if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
  console.error(label, e);
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}

// Resolve a period by _id or by key ('YYYY-MM'). If a key is given for a period
// that has not been materialized yet, materialize its whole FY first.
async function resolvePeriod(db, id) {
  const col = db.collection('fiscal_periods');

  if (ObjectId.isValid(id)) {
    const byId = await col.findOne({ _id: new ObjectId(id) });
    if (byId) return byId;
  }

  let byKey = await col.findOne({ key: id });
  if (byKey) return byKey;

  const m = /^(\d{4})-(\d{2})$/.exec(id);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const monthIndex0 = parseInt(m[2], 10) - 1;
  if (monthIndex0 < 0 || monthIndex0 > 11) return null;

  const fyStart = fyStartForDate(new Date(Date.UTC(year, monthIndex0, 1)));
  const descriptors = monthlyPeriodsForFY(fyStart);
  const ops = descriptors.map((p) => ({
    updateOne: {
      filter: { key: p.key },
      update: { $setOnInsert: { ...p, status: 'open', createdAt: new Date() } },
      upsert: true,
    },
  }));
  await col.bulkWrite(ops, { ordered: false });

  byKey = await col.findOne({ key: id });
  return byKey;
}

// Close or reopen a fiscal period. Body: { status: 'closed' | 'open' }.
async function handle(request, params) {
  const { user, response } = await requireFinanceAdmin(request, { mutation: true });
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = body.status;
  if (status !== 'open' && status !== 'closed') {
    throw new FinanceError("status must be 'open' or 'closed'", 400);
  }

  const client = await clientPromise;
  const db = client.db('resources');
  const col = db.collection('fiscal_periods');

  const period = await resolvePeriod(db, id);
  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });

  const set = { status };
  if (status === 'closed') {
    set.closedAt = new Date();
    set.closedBy = actorFromUser(user);
  } else {
    set.closedAt = null;
    set.closedBy = null;
  }

  await col.updateOne({ _id: period._id }, { $set: set });
  const after = { ...period, ...set };

  await recordFinanceAudit(db, {
    action: status === 'closed' ? 'period.close' : 'period.reopen',
    collection: 'fiscal_periods',
    documentId: period._id,
    actor: actorFromUser(user),
    before: period,
    after,
    meta: { key: period.key },
  });

  return NextResponse.json(after);
}

export async function PUT(request, { params }) {
  try {
    return await handle(request, params);
  } catch (e) {
    return financeCatch(e, 'PUT /api/organization/fiscal-periods/[id] error');
  }
}

export async function POST(request, { params }) {
  try {
    return await handle(request, params);
  } catch (e) {
    return financeCatch(e, 'POST /api/organization/fiscal-periods/[id] error');
  }
}
