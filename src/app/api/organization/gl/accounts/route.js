import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { FinanceError } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString } from '../../../../../lib/finance/auth';
import { seedChartOfAccounts, ACCOUNT_TYPES } from '../../../../../lib/finance/gl';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';

// Normal balance implied by account type (assets/expenses debit; the rest credit).
const NORMAL_BY_TYPE = {
  asset: 'debit',
  expense: 'debit',
  liability: 'credit',
  equity: 'credit',
  income: 'credit',
};

function financeCatch(e, label) {
  if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
  console.error(label, e);
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}

// GET /api/organization/gl/accounts — list the chart of accounts. Auto-seeds the
// standard chart on first hit if `gl_accounts` is empty.
export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('gl_accounts');

    const count = await col.countDocuments({});
    if (count === 0) {
      await seedChartOfAccounts(db);
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const filter = includeInactive ? {} : { active: { $ne: false } };

    const accounts = await col.find(filter).sort({ code: 1 }).toArray();
    return NextResponse.json({ accounts, types: ACCOUNT_TYPES, seeded: count === 0 });
  } catch (e) {
    return financeCatch(e, 'GET /api/organization/gl/accounts error');
  }
}

// POST /api/organization/gl/accounts — add a custom account.
export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const code = capString(body.code, 20).trim();
    const name = capString(body.name, 120);
    const type = capString(body.type, 20);

    if (!/^\d{3,6}$/.test(code)) {
      throw new FinanceError('Account code must be 3–6 digits', 400);
    }
    if (!name) throw new FinanceError('Account name is required', 400);
    if (!ACCOUNT_TYPES.includes(type)) {
      throw new FinanceError(`Account type must be one of: ${ACCOUNT_TYPES.join(', ')}`, 400);
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('gl_accounts');

    const doc = {
      code,
      name,
      type,
      normalBalance: NORMAL_BY_TYPE[type],
      system: false,
      active: true,
      createdAt: new Date(),
    };

    try {
      const res = await col.insertOne(doc);
      await recordFinanceAudit(db, {
        action: 'gl.account.create',
        collection: 'gl_accounts',
        documentId: res.insertedId,
        actor: actorFromUser(user),
        after: doc,
        meta: { code, type },
      });
      return NextResponse.json({ _id: res.insertedId, ...doc }, { status: 201 });
    } catch (err) {
      if (err && err.code === 11000) {
        return NextResponse.json({ error: `Account code ${code} already exists` }, { status: 409 });
      }
      throw err;
    }
  } catch (e) {
    return financeCatch(e, 'POST /api/organization/gl/accounts error');
  }
}
