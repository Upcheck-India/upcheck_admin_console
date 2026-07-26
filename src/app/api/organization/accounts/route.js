import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { requireFinanceAdmin, capString } from '../../../../lib/finance/auth';
import { recordFinanceAudit, actorFromUser } from '../../../../lib/finance/audit';

export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');
    const accounts = await db
      .collection('finance_accounts')
      .find({ archivedAt: { $exists: false } })
      .sort({ name: 1 })
      .toArray();
    return NextResponse.json({ accounts });
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

    const doc = { name, createdAt: new Date(), createdBy: actorFromUser(user) };
    const client = await clientPromise;
    const db = client.db('resources');
    const res = await db.collection('finance_accounts').insertOne(doc);
    await recordFinanceAudit(db, {
      action: 'account.create', collection: 'finance_accounts', documentId: res.insertedId,
      actor: actorFromUser(user), after: doc,
    });
    return NextResponse.json({ _id: res.insertedId, ...doc }, { status: 201 });
  } catch (e) {
    console.error('POST /api/organization/accounts error', e);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
