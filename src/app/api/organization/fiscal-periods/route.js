import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { FinanceError } from '../../../../lib/finance/tx';
import { requireFinanceAdmin } from '../../../../lib/finance/auth';
import { monthlyPeriodsForFY } from '../../../../lib/finance/periods';
import { recordFinanceAudit, actorFromUser } from '../../../../lib/finance/audit';

function financeCatch(e, label) {
  if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
  console.error(label, e);
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}

// GET /api/organization/fiscal-periods — list periods.
// With ?fyStart=YYYY: if that FY has no materialized periods yet, return the 12
// virtual (status:'open') descriptors so the UI can render and materialize them.
export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('fiscal_periods');

    const { searchParams } = new URL(request.url);
    const fyStartRaw = searchParams.get('fyStart');

    if (fyStartRaw != null && fyStartRaw !== '') {
      const fyStart = parseInt(fyStartRaw, 10);
      if (!Number.isFinite(fyStart)) throw new FinanceError('Invalid fyStart', 400);

      const existing = await col.find({ fyStart }).sort({ start: 1 }).toArray();
      if (existing.length > 0) {
        return NextResponse.json({ periods: existing, fyStart, virtual: false });
      }
      const virtual = monthlyPeriodsForFY(fyStart).map((p) => ({ ...p, status: 'open', virtual: true }));
      return NextResponse.json({ periods: virtual, fyStart, virtual: true });
    }

    const periods = await col.find({}).sort({ start: 1 }).toArray();
    return NextResponse.json({ periods });
  } catch (e) {
    return financeCatch(e, 'GET /api/organization/fiscal-periods error');
  }
}

// POST /api/organization/fiscal-periods — materialize the 12 monthly periods for
// a fiscal year. Idempotent (upsert on key; existing periods are untouched).
export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const fyStart = parseInt(body.fyStart, 10);
    if (!Number.isFinite(fyStart)) throw new FinanceError('A valid fyStart (year) is required', 400);

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('fiscal_periods');

    const descriptors = monthlyPeriodsForFY(fyStart);
    const ops = descriptors.map((p) => ({
      updateOne: {
        filter: { key: p.key },
        update: { $setOnInsert: { ...p, status: 'open', createdAt: new Date() } },
        upsert: true,
      },
    }));
    const res = await col.bulkWrite(ops, { ordered: false });

    const periods = await col.find({ fyStart }).sort({ start: 1 }).toArray();

    await recordFinanceAudit(db, {
      action: 'period.materialize',
      collection: 'fiscal_periods',
      actor: actorFromUser(user),
      meta: { fyStart, upserted: res.upsertedCount || 0, total: descriptors.length },
    });

    return NextResponse.json({ periods, fyStart, created: res.upsertedCount || 0 }, { status: 201 });
  } catch (e) {
    return financeCatch(e, 'POST /api/organization/fiscal-periods error');
  }
}
