// src/lib/finance/tx.js
import { ObjectId } from 'mongodb';

// Shared helpers for safe money movement in the finance module.
//
// The finance routes move money across two collections (org_funds ledger and
// org_untransferred pool). Those writes must be all-or-nothing, so we run them
// inside a MongoDB transaction. Transactions require a replica set / mongos; on
// a standalone dev Mongo they are unavailable, so withFinanceTransaction falls
// back to running the same work without a session. The work function is written
// to be idempotent (keyed by opId) and to use atomic guarded updates, so even
// the non-transactional fallback avoids creating or double-spending money under
// normal retries/races — the transaction only closes the rare partial-failure
// window.

/**
 * A business/validation error that should be surfaced to the client with a
 * specific HTTP status and must NOT trigger the standalone fallback.
 */
export class FinanceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'FinanceError';
    this.status = status;
    this.isFinanceError = true;
  }
}

function isNoTransactionSupport(err) {
  const msg = String(err?.message || '');
  return (
    err?.code === 20 ||
    err?.codeName === 'IllegalOperation' ||
    /Transaction numbers are only allowed on a replica set member or mongos/i.test(msg) ||
    /Transactions are not supported/i.test(msg) ||
    /This MongoDB deployment does not support retryable writes/i.test(msg)
  );
}

/**
 * Run `work(session)` inside a transaction when the deployment supports it,
 * otherwise fall back to `work(null)`. `work` must accept a session (or null)
 * and pass it into every db operation it performs.
 *
 * FinanceError thrown by `work` aborts the transaction and is re-thrown as-is
 * (no fallback). Any other unexpected error also aborts and propagates.
 *
 * @template T
 * @param {import('mongodb').MongoClient} client
 * @param {(session: import('mongodb').ClientSession | null) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function withFinanceTransaction(client, work) {
  let session;
  try {
    session = client.startSession();
  } catch {
    // Could not even start a session (very old/edge deployment) — run bare.
    return work(null);
  }

  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (err) {
    if (err && err.isFinanceError) throw err;
    if (isNoTransactionSupport(err)) {
      // Standalone Mongo: the transactional attempt never wrote anything
      // (the first op failed to open the transaction). Safe to run bare.
      return work(null);
    }
    throw err;
  } finally {
    try {
      await session.endSession();
    } catch {
      /* ignore */
    }
  }
}

/** Escape a user string so it can be used as a literal inside a $regex. */
export function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Throw a FinanceError unless `accountId` refers to an existing finance_accounts
 * document. Accepts the string form of the account ObjectId (as sent by the UI).
 */
export async function assertAccountExists(db, accountId, session = null) {
  const idStr = accountId == null ? '' : String(accountId);
  if (!idStr || !ObjectId.isValid(idStr)) {
    throw new FinanceError('A valid accountId is required', 400);
  }
  const acc = await db
    .collection('finance_accounts')
    .findOne({ _id: new ObjectId(idStr) }, { projection: { _id: 1 }, session });
  if (!acc) throw new FinanceError('Account not found', 400);
}
