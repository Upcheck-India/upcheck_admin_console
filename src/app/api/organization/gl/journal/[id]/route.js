import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../../lib/mongodb';
import { requireFinanceAdmin } from '../../../../../../lib/finance/auth';

// GET /api/organization/gl/journal/[id] — fetch a single journal entry.
// Posted journals are immutable; corrections are reversing entries (see
// /journal/[id]/reverse).
export async function GET(request, { params }) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid journal id' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const entry = await db.collection('journal_entries').findOne({ _id: new ObjectId(id) });
    if (!entry) return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });

    return NextResponse.json(entry);
  } catch (e) {
    console.error('GET /api/organization/gl/journal/[id] error', e);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
