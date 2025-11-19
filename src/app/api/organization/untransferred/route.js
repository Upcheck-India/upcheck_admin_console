import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
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

export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const client = await clientPromise;
    const db = client.db('resources');

    const filter = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { source: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    // Only show items with remaining amount > 0
    const allItems = await db.collection('org_untransferred')
      .find(filter)
      .sort({ receivedAt: -1, createdAt: -1 })
      .toArray();

    const items = allItems.filter(it => {
      const remaining = it.remainingAmount ?? it.amount;
      return remaining > 0;
    });

    // Summary should reflect only currently unassigned funds (remaining > 0)
    const summary = items.reduce((acc, it) => {
      const remaining = it.remainingAmount ?? it.amount ?? 0;
      acc.total += it.amount || remaining;
      acc.remaining += remaining;
      return acc;
    }, { total: 0, remaining: 0 });

    return NextResponse.json({ items, summary });
  } catch (e) {
    console.error('GET /api/organization/untransferred error', e);
    return NextResponse.json({ error: 'Failed to fetch untransferred funds' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { amount, title, source, notes, receivedAt, relatedApplicationId } = body || {};
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const doc = {
      amount: amt,
      remainingAmount: amt,
      title: title.trim(),
      source: source || '',
      notes: notes || '',
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      relatedApplicationId: relatedApplicationId || null,
      history: [],
      createdAt: new Date(),
      createdBy: { id: user._id?.toString?.() || null, email: user.email, username: user.username, role: user.role },
    };

    const client = await clientPromise;
    const db = client.db('resources');
    const res = await db.collection('org_untransferred').insertOne(doc);
    return NextResponse.json({ _id: res.insertedId, ...doc }, { status: 201 });
  } catch (e) {
    console.error('POST /api/organization/untransferred error', e);
    return NextResponse.json({ error: 'Failed to create untransferred fund' }, { status: 500 });
  }
}
