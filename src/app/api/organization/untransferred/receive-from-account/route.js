import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
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

export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { accountId, amount, date, title, notes } = body || {};
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    if (!title || typeof title !== 'string') return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');

    // Create outflow entry in funds (transfer)
    const fundsDoc = {
      kind: 'out',
      amount: amt,
      title: `Move to Untransferred: ${title.trim()}`,
      date: date ? new Date(date) : new Date(),
      notes: notes || 'Moved from billing account to untransferred pool',
      category: 'other',
      accountId,
      inflowType: null,
      expenseType: null,
      allocations: [],
      source: '',
      counterparty: '',
      reference: 'untransferred:receive',
      tags: ['transfer'],
      isTransfer: true,
      createdAt: new Date(),
      createdBy: { id: user._id?.toString?.() || null, email: user.email, username: user.username, role: user.role },
    };

    await db.collection('org_funds').insertOne(fundsDoc);

    // Create untransferred item
    const unDoc = {
      amount: amt,
      remainingAmount: amt,
      title: title.trim(),
      source: 'Internal move',
      notes: notes || '',
      receivedAt: date ? new Date(date) : new Date(),
      relatedApplicationId: null,
      history: [
        { type: 'receive_from_account', accountId, amount: amt, at: new Date(), by: { id: user._id?.toString?.() || null, username: user.username } }
      ],
      createdAt: new Date(),
      createdBy: { id: user._id?.toString?.() || null, email: user.email, username: user.username, role: user.role },
    };

    const res = await db.collection('org_untransferred').insertOne(unDoc);

    return NextResponse.json({ _id: res.insertedId, ...unDoc }, { status: 201 });
  } catch (e) {
    console.error('POST /api/organization/untransferred/receive-from-account error', e);
    return NextResponse.json({ error: 'Failed to receive from account' }, { status: 500 });
  }
}
