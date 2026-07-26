import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { requireFinanceAdmin, capString } from '../../../../../lib/finance/auth';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';
import { sanitizeAccount, buildBankUpdate, resolveCurrency } from '../_lib';

const SAFE_PROJECTION = { 'bank.accountNumberEnc': 0, 'bank.accountNumberHash': 0 };

export async function GET(request, { params }) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const doc = await db
      .collection('finance_accounts')
      .findOne({ _id: new ObjectId(id) }, { projection: SAFE_PROJECTION });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(sanitizeAccount(doc));
  } catch (e) {
    console.error('GET /api/organization/accounts/[id] error', e);
    return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const name = capString(body?.name, 120);
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    // Load the full existing doc (incl. encrypted fields) so a blank account
    // number can carry the stored value forward. It is NEVER returned/logged raw.
    const existing = await db.collection('finance_accounts').findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const actor = actorFromUser(user);
    const set = { name, updatedAt: new Date(), updatedBy: actor };

    try {
      set.currency = resolveCurrency(body?.currency ?? existing.currency);

      if (body?.clearBank === true) {
        set.bank = null;
      } else if (body?.bank && typeof body.bank === 'object') {
        set.bank = buildBankUpdate(body.bank, existing.bank || null, actor);
      }
    } catch (err) {
      if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
      throw err;
    }

    // Dedupe when a (possibly new) number is present — exclude this account.
    if (set.bank && set.bank.accountNumberHash) {
      const dup = await db.collection('finance_accounts').findOne(
        {
          _id: { $ne: new ObjectId(id) },
          'bank.accountNumberHash': set.bank.accountNumberHash,
          archivedAt: { $exists: false },
        },
        { projection: { _id: 1 } }
      );
      if (dup) {
        return NextResponse.json(
          { error: 'An account with this bank account number already exists' },
          { status: 409 }
        );
      }
    }

    await db.collection('finance_accounts').updateOne({ _id: new ObjectId(id) }, { $set: set });

    const updatedDoc = { ...existing, ...set };
    await recordFinanceAudit(db, {
      action: 'account.update',
      collection: 'finance_accounts',
      documentId: id,
      actor,
      before: sanitizeAccount(existing), // sanitized — no enc/hash/raw number
      after: sanitizeAccount(updatedDoc),
    });

    return NextResponse.json(sanitizeAccount(updatedDoc));
  } catch (e) {
    console.error('PUT /api/organization/accounts/[id] error', e);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const existing = await db.collection('finance_accounts').findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Referential integrity: never orphan financial records. If any live ledger
    // entry references this account, refuse to delete and report the count.
    const txCount = await db.collection('org_funds').countDocuments({ accountId: id, deletedAt: { $exists: false } });
    if (txCount > 0) {
      return NextResponse.json(
        { error: `Account has ${txCount} transaction(s). Reassign or delete them first.`, transactionCount: txCount },
        { status: 409 }
      );
    }

    await db.collection('finance_accounts').deleteOne({ _id: new ObjectId(id) });
    await recordFinanceAudit(db, {
      action: 'account.delete',
      collection: 'finance_accounts',
      documentId: id,
      actor: actorFromUser(user),
      before: sanitizeAccount(existing), // sanitized — no enc/hash/raw number
    });
    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error('DELETE /api/organization/accounts/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
