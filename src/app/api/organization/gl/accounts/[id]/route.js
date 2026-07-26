import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../../lib/mongodb';
import { FinanceError } from '../../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString } from '../../../../../../lib/finance/auth';
import { ACCOUNT_TYPES } from '../../../../../../lib/finance/gl';
import { recordFinanceAudit, actorFromUser } from '../../../../../../lib/finance/audit';

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

// PUT /api/organization/gl/accounts/[id] — rename / activate / deactivate.
// System accounts may be renamed and toggled active, but their code and type are
// immutable (they anchor the automatic postings).
export async function PUT(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid account id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('gl_accounts');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const update = {};
    if (body.name != null) {
      const name = capString(body.name, 120);
      if (!name) throw new FinanceError('Account name cannot be empty', 400);
      update.name = name;
    }
    if (body.active != null) update.active = !!body.active;

    if (body.code != null || body.type != null) {
      if (existing.system) {
        throw new FinanceError('The code and type of a system account cannot be changed', 400);
      }
      if (body.code != null) {
        const code = capString(body.code, 20).trim();
        if (!/^\d{3,6}$/.test(code)) throw new FinanceError('Account code must be 3–6 digits', 400);
        update.code = code;
      }
      if (body.type != null) {
        const type = capString(body.type, 20);
        if (!ACCOUNT_TYPES.includes(type)) {
          throw new FinanceError(`Account type must be one of: ${ACCOUNT_TYPES.join(', ')}`, 400);
        }
        update.type = type;
        update.normalBalance = NORMAL_BY_TYPE[type];
      }
    }

    if (Object.keys(update).length === 0) {
      throw new FinanceError('Nothing to update', 400);
    }
    update.updatedAt = new Date();

    try {
      await col.updateOne({ _id: existing._id }, { $set: update });
    } catch (err) {
      if (err && err.code === 11000) {
        return NextResponse.json({ error: `Account code ${update.code} already exists` }, { status: 409 });
      }
      throw err;
    }

    const after = { ...existing, ...update };
    await recordFinanceAudit(db, {
      action: 'gl.account.update',
      collection: 'gl_accounts',
      documentId: existing._id,
      actor: actorFromUser(user),
      before: existing,
      after,
    });

    return NextResponse.json(after);
  } catch (e) {
    return financeCatch(e, 'PUT /api/organization/gl/accounts/[id] error');
  }
}

// DELETE /api/organization/gl/accounts/[id] — soft-delete (active:false). Never
// hard-deletes: postings must always resolve their account. System accounts
// cannot be deleted.
export async function DELETE(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid account id' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('gl_accounts');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (existing.system) {
      throw new FinanceError('System accounts cannot be deleted', 400);
    }

    const hasPostings = await db
      .collection('journal_entries')
      .findOne({ 'lines.accountCode': existing.code }, { projection: { _id: 1 } });

    await col.updateOne({ _id: existing._id }, { $set: { active: false, updatedAt: new Date() } });

    await recordFinanceAudit(db, {
      action: 'gl.account.delete',
      collection: 'gl_accounts',
      documentId: existing._id,
      actor: actorFromUser(user),
      before: existing,
      after: { ...existing, active: false },
      meta: { softDelete: true, hadPostings: !!hasPostings },
    });

    return NextResponse.json({ ok: true, softDeleted: true, hadPostings: !!hasPostings });
  } catch (e) {
    return financeCatch(e, 'DELETE /api/organization/gl/accounts/[id] error');
  }
}
