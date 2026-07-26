import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { FinanceError, withFinanceTransaction } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString, parseLimit } from '../../../../../lib/finance/auth';
import { loadAccountIndex, postJournal } from '../../../../../lib/finance/gl';
import { presetRange } from '../../../../../lib/finance/dates';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';

function financeCatch(e, label) {
  if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
  console.error(label, e);
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}

// GET /api/organization/gl/journal — list journal entries.
// Filters: startDate/endDate (or datePreset), accountCode, source, accountId (meta.accountId).
export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const datePreset = searchParams.get('datePreset');
    const accountCode = searchParams.get('accountCode');
    const source = searchParams.get('source');
    const accountId = searchParams.get('accountId');
    const limit = parseLimit(searchParams.get('limit'), { def: 200, max: 1000 });
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10) || 0);

    let rangeStart = startDate ? new Date(startDate) : null;
    let rangeEnd = endDate ? new Date(endDate) : null;
    if (!rangeStart && !rangeEnd && datePreset) {
      const r = presetRange(datePreset);
      rangeStart = r.start;
      rangeEnd = r.end;
    }

    const filter = {};
    if (rangeStart || rangeEnd) {
      filter.date = {};
      if (rangeStart) filter.date.$gte = rangeStart;
      if (rangeEnd) filter.date.$lte = rangeEnd;
    }
    if (accountCode) filter['lines.accountCode'] = accountCode;
    if (source) filter.source = source;
    if (accountId) filter['meta.accountId'] = accountId;

    const col = db.collection('journal_entries');
    const totalCount = await col.countDocuments(filter);
    const items = await col
      .find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      items,
      pagination: { total: totalCount, skip, limit, returned: items.length },
    });
  } catch (e) {
    return financeCatch(e, 'GET /api/organization/gl/journal error');
  }
}

// POST /api/organization/gl/journal — post a MANUAL balanced journal entry.
// Body: { date, description, lines: [{ accountCode, debitMinor|creditMinor OR debit|credit (rupees), accountId?, memo? }] }
export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    if (rawLines.length < 2) {
      throw new FinanceError('A journal entry needs at least two lines', 400);
    }

    // Normalize each line to integer paise, accepting either minor units directly
    // or rupee amounts (debit/credit). postJournal validates the rest.
    const lines = rawLines.map((l) => {
      const line = {
        accountCode: capString(l.accountCode, 20).trim(),
        accountId: l.accountId != null ? String(l.accountId) : null,
        memo: l.memo ? capString(l.memo, 500) : null,
      };
      if (l.debitMinor != null || l.creditMinor != null) {
        line.debitMinor = Math.round(Number(l.debitMinor) || 0);
        line.creditMinor = Math.round(Number(l.creditMinor) || 0);
      } else {
        line.debitMinor = Math.round((Number(l.debit) || 0) * 100);
        line.creditMinor = Math.round((Number(l.credit) || 0) * 100);
      }
      return line;
    });

    const client = await clientPromise;
    const db = client.db('resources');
    const actor = actorFromUser(user);

    const entry = await withFinanceTransaction(client, async (session) => {
      const accountIndex = await loadAccountIndex(db, session);
      const { entry: posted } = await postJournal(
        db,
        {
          date: body.date || new Date(),
          description: capString(body.description, 1000),
          source: 'manual',
          actor,
          meta: { accountId: body.accountId != null ? String(body.accountId) : null, manual: true },
          lines,
        },
        { session, accountIndex }
      );
      await recordFinanceAudit(
        db,
        {
          action: 'gl.journal.create',
          collection: 'journal_entries',
          documentId: posted._id,
          actor,
          after: posted,
          meta: { source: 'manual', debitTotalMinor: posted.debitTotalMinor },
        },
        session
      );
      return posted;
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    return financeCatch(e, 'POST /api/organization/gl/journal error');
  }
}
