import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { escapeRegex } from '../../../../lib/finance/tx';
import { requireFinanceAdmin, capString } from '../../../../lib/finance/auth';
import { moneyFields, readMinor, fromMinor } from '../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../lib/finance/audit';

export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const client = await clientPromise;
    const db = client.db('resources');

    const filter = { deletedAt: { $exists: false } };
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { source: { $regex: safe, $options: 'i' } },
        { notes: { $regex: safe, $options: 'i' } },
      ];
    }

    const allItems = await db.collection('org_untransferred')
      .find(filter)
      .sort({ receivedAt: -1, createdAt: -1 })
      .toArray();

    // Only show items with a remaining (unassigned) balance.
    const items = allItems.filter((it) => readMinor(it, 'remainingAmount') > 0);

    // Summaries computed in integer paise for exactness, returned as rupees.
    const totals = items.reduce((acc, it) => {
      acc.remainingMinor += readMinor(it, 'remainingAmount');
      // "total" should reflect only the unassigned portion, not the original amount.
      acc.totalMinor += readMinor(it, 'remainingAmount');
      return acc;
    }, { remainingMinor: 0, totalMinor: 0 });

    const summary = { total: fromMinor(totals.totalMinor), remaining: fromMinor(totals.remainingMinor) };

    return NextResponse.json({ items, summary });
  } catch (e) {
    console.error('GET /api/organization/untransferred error', e);
    return NextResponse.json({ error: 'Failed to fetch untransferred funds' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json();
    const { amount, title, source, notes, receivedAt, relatedApplicationId } = body || {};
    const money = (() => {
      try { return moneyFields('amount', amount); } catch { return null; }
    })();
    if (!money || money.amountMinor <= 0) return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    const cleanTitle = capString(title, 200);
    if (!cleanTitle) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const doc = {
      ...money,
      remainingAmount: money.amount,
      remainingAmountMinor: money.amountMinor,
      title: cleanTitle,
      source: capString(source, 200),
      notes: capString(notes, 2000),
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      relatedApplicationId: relatedApplicationId || null,
      history: [],
      createdAt: new Date(),
      createdBy: actorFromUser(user),
    };

    const client = await clientPromise;
    const db = client.db('resources');
    const res = await db.collection('org_untransferred').insertOne(doc);
    await recordFinanceAudit(db, {
      action: 'untransferred.create', collection: 'org_untransferred', documentId: res.insertedId,
      actor: actorFromUser(user), after: doc,
    });
    return NextResponse.json({ _id: res.insertedId, ...doc }, { status: 201 });
  } catch (e) {
    console.error('POST /api/organization/untransferred error', e);
    return NextResponse.json({ error: 'Failed to create untransferred fund' }, { status: 500 });
  }
}
