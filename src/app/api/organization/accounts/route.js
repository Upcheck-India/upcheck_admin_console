import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { requireFinanceAdmin, capString } from '../../../../lib/finance/auth';
import { recordFinanceAudit, actorFromUser } from '../../../../lib/finance/audit';
import { sanitizeAccount, buildBankUpdate, resolveCurrency } from './_lib';

// Never project the encrypted number or its fingerprint out of Mongo. Even so,
// every response is additionally routed through sanitizeAccount() as defense in
// depth, so enc/hash can never reach a client.
const SAFE_PROJECTION = { 'bank.accountNumberEnc': 0, 'bank.accountNumberHash': 0 };

export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');
    const docs = await db
      .collection('finance_accounts')
      .find({ archivedAt: { $exists: false } }, { projection: SAFE_PROJECTION })
      .sort({ name: 1 })
      .toArray();
    return NextResponse.json({ accounts: docs.map(sanitizeAccount) });
  } catch (e) {
    console.error('GET /api/organization/accounts error', e);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json();
    const name = capString(body?.name, 120);
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const actor = actorFromUser(user);

    let currency;
    let bank;
    try {
      currency = resolveCurrency(body?.currency);
      bank = buildBankUpdate(body?.bank, null, actor);
    } catch (err) {
      if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
      throw err;
    }

    // Dedupe: reject if another non-archived account already holds this number.
    if (bank && bank.accountNumberHash) {
      const dup = await db.collection('finance_accounts').findOne(
        { 'bank.accountNumberHash': bank.accountNumberHash, archivedAt: { $exists: false } },
        { projection: { _id: 1 } }
      );
      if (dup) {
        return NextResponse.json(
          { error: 'An account with this bank account number already exists' },
          { status: 409 }
        );
      }
    }

    const doc = {
      name,
      currency,
      bank: bank || null,
      createdAt: new Date(),
      createdBy: actor,
    };
    const res = await db.collection('finance_accounts').insertOne(doc);
    const safe = sanitizeAccount({ _id: res.insertedId, ...doc });

    await recordFinanceAudit(db, {
      action: 'account.create',
      collection: 'finance_accounts',
      documentId: res.insertedId,
      actor,
      after: safe, // sanitized — never contains enc/hash/raw number
    });

    return NextResponse.json(safe, { status: 201 });
  } catch (e) {
    console.error('POST /api/organization/accounts error', e);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
