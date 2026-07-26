import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { requireFinanceAdmin, parseLimit } from '../../../../../lib/finance/auth';

// GET — list finance backups (metadata only), newest first.
export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'), { def: 50, max: 200 });

    const client = await clientPromise;
    const db = client.db('resources');
    const items = await db
      .collection('finance_backups')
      .find({}, { projection: { /* meta only; items live elsewhere */ } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const backups = items.map((b) => ({
      id: String(b._id),
      createdAt: b.createdAt,
      createdBy: b.createdBy || null,
      mode: b.mode || null,
      note: b.note || '',
      status: b.status || 'complete',
      collections: Array.isArray(b.collections) ? b.collections : [],
      counts: b.counts || {},
      totalDocs: b.counts ? Object.values(b.counts).reduce((a, n) => a + (Number(n) || 0), 0) : 0,
    }));
    return NextResponse.json({ backups });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/finance/backups error', e);
    return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 });
  }
}
