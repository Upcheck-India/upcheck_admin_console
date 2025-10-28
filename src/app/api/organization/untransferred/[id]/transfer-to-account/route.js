import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

async function getUserFromToken(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, username: 1, role: 1 } }
    );
    return user;
  } catch {
    return null;
  }
}

function isAdminLike(user) {
  return user && (user.role === 'Admin' || user.role === 'Console admin');
}

export async function POST(request, { params }) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    const body = await request.json();
    const { accountId, amount, date, notes, inflowType } = body || {};
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');

    const item = await db.collection('org_untransferred').findOne({ _id: new ObjectId(id) });
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const remaining = item.remainingAmount ?? item.amount;
    if (amt > remaining) return NextResponse.json({ error: 'Amount exceeds remaining balance' }, { status: 400 });

    // Create funds inflow entry (transfer)
    const fundsDoc = {
      kind: 'in',
      amount: amt,
      title: `Transfer: ${item.title}`,
      date: date ? new Date(date) : new Date(),
      notes: notes || `Transfer from untransferred pool (${item.source || 'unknown'})`,
      category: 'other',
      accountId,
      inflowType: inflowType || null,
      expenseType: null,
      fundRestriction: 'unrestricted',
      allocations: [],
      source: item.source || '',
      counterparty: '',
      reference: `untransferred:${id}`,
      tags: ['transfer'],
      isTransfer: true,
      createdAt: new Date(),
      createdBy: { id: user._id?.toString?.() || null, email: user.email, username: user.username, role: user.role },
    };

    const sessionClient = await clientPromise;
    const sessionDb = sessionClient.db('resources');

    await sessionDb.collection('org_funds').insertOne(fundsDoc);

    // Update untransferred item
    const history = item.history || [];
    history.push({
      type: 'transfer_to_account',
      accountId,
      amount: amt,
      at: new Date(),
      by: { id: user._id?.toString?.() || null, username: user.username },
    });
    const newRemaining = remaining - amt;
    await sessionDb.collection('org_untransferred').updateOne(
      { _id: new ObjectId(id) },
      { $set: { remainingAmount: newRemaining, updatedAt: new Date() }, $push: { history } }
    );

    return NextResponse.json({ success: true, remaining: newRemaining });
  } catch (e) {
    console.error('POST /api/organization/untransferred/[id]/transfer-to-account error', e);
    return NextResponse.json({ error: 'Failed to transfer' }, { status: 500 });
  }
}
