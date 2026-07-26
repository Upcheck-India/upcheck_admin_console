import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { FinanceError } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString } from '../../../../../lib/finance/auth';
import { fromMinor } from '../../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';

function financeCatch(e, label) {
  if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
  console.error(label, e);
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}

// Read a money value in either minor (paise) or rupee form → integer paise.
function readMoney(minorVal, rupeeVal) {
  if (minorVal != null && minorVal !== '') return Math.round(Number(minorVal) || 0);
  return Math.round((Number(rupeeVal) || 0) * 100);
}

// GET /api/organization/bank-reconciliation/statements?accountId=... — list statements.
export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');

    const statements = await db
      .collection('bank_statements')
      .find({ accountId })
      .sort({ statementDate: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json({ statements });
  } catch (e) {
    return financeCatch(e, 'GET /api/organization/bank-reconciliation/statements error');
  }
}

// POST /api/organization/bank-reconciliation/statements — create a statement plus
// its lines. Body: { accountId, statementDate, openingBalance|openingBalanceMinor,
// closingBalance|closingBalanceMinor, note, lines: [{ date, description,
// amount|amountMinor (signed: + inflow, − outflow) }] }.
export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const accountId = body.accountId != null ? String(body.accountId) : '';
    if (!accountId) throw new FinanceError('accountId is required', 400);

    const client = await clientPromise;
    const db = client.db('resources');
    const actor = actorFromUser(user);

    const openingBalanceMinor = readMoney(body.openingBalanceMinor, body.openingBalance);
    const closingBalanceMinor = readMoney(body.closingBalanceMinor, body.closingBalance);
    const statementDate = body.statementDate ? new Date(body.statementDate) : new Date();

    const statementDoc = {
      accountId,
      statementDate,
      openingBalance: fromMinor(openingBalanceMinor),
      openingBalanceMinor,
      closingBalance: fromMinor(closingBalanceMinor),
      closingBalanceMinor,
      note: capString(body.note, 1000),
      createdAt: new Date(),
      createdBy: actor,
    };

    const stmtRes = await db.collection('bank_statements').insertOne(statementDoc);
    const statementId = stmtRes.insertedId;

    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    const txnDocs = rawLines
      .map((l) => {
        const amountMinor = readMoney(l.amountMinor, l.amount);
        return {
          statementId,
          accountId,
          date: l.date ? new Date(l.date) : statementDate,
          description: capString(l.description, 500),
          amountMinor,
          reconciled: false,
          matchedJournalId: null,
          createdAt: new Date(),
        };
      })
      .filter((t) => t.amountMinor !== 0 || t.description);

    let insertedTxns = 0;
    if (txnDocs.length > 0) {
      const txnRes = await db.collection('bank_txns').insertMany(txnDocs);
      insertedTxns = txnRes.insertedCount || 0;
    }

    await recordFinanceAudit(db, {
      action: 'bankrec.statement.create',
      collection: 'bank_statements',
      documentId: statementId,
      actor,
      after: statementDoc,
      meta: { accountId, insertedTxns },
    });

    return NextResponse.json(
      { statement: { _id: statementId, ...statementDoc }, insertedTxns },
      { status: 201 }
    );
  } catch (e) {
    return financeCatch(e, 'POST /api/organization/bank-reconciliation/statements error');
  }
}
