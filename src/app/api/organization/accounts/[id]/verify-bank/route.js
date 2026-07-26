import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { requireFinanceAdmin } from '../../../../../../lib/finance/auth';
import { recordFinanceAudit, actorFromUser } from '../../../../../../lib/finance/audit';
import { fingerprint, fingerprintsEqual } from '../../../../../../lib/finance/crypto';

// POST /api/organization/accounts/[id]/verify-bank
// Body: { accountNumber }
// Confirms a submitted number matches the one on file WITHOUT ever revealing the
// stored number: it re-fingerprints the input and constant-time compares it to
// the stored HMAC. The submitted number is never persisted, returned, or logged.
export async function POST(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const accountNumber = typeof body?.accountNumber === 'string' ? body.accountNumber : '';
    if (!accountNumber.trim()) {
      return NextResponse.json({ error: 'An account number is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    // Only the fields needed to verify — never pull the ciphertext into scope.
    const doc = await db.collection('finance_accounts').findOne(
      { _id: new ObjectId(id) },
      { projection: { 'bank.accountNumberHash': 1, 'bank.accountNumberLast4': 1 } }
    );
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const storedHash = doc.bank?.accountNumberHash;
    if (!storedHash) {
      return NextResponse.json({ error: 'No bank details on file' }, { status: 400 });
    }

    const candidateHash = fingerprint(accountNumber);
    const match = fingerprintsEqual(candidateHash, storedHash);
    const last4 = doc.bank?.accountNumberLast4 || null;

    await recordFinanceAudit(db, {
      action: 'account.verify_bank',
      collection: 'finance_accounts',
      documentId: id,
      actor: actorFromUser(user),
      meta: { match }, // never the submitted number
    });

    return NextResponse.json({ match, last4 });
  } catch (e) {
    console.error('POST /api/organization/accounts/[id]/verify-bank error', e);
    return NextResponse.json({ error: 'Failed to verify account number' }, { status: 500 });
  }
}
