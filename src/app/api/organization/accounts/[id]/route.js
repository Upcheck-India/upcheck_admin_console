import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { requireFinanceAdmin, capString } from '../../../../../lib/finance/auth';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';

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
    const existing = await db.collection('finance_accounts').findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.collection('finance_accounts').updateOne(
      { _id: new ObjectId(id) },
      { $set: { name, updatedAt: new Date(), updatedBy: actorFromUser(user) } }
    );
    await recordFinanceAudit(db, {
      action: 'account.update', collection: 'finance_accounts', documentId: id,
      actor: actorFromUser(user), before: existing, after: { ...existing, name },
    });
    return NextResponse.json({ _id: id, name });
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
      action: 'account.delete', collection: 'finance_accounts', documentId: id,
      actor: actorFromUser(user), before: existing,
    });
    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error('DELETE /api/organization/accounts/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
