// src/lib/finance/gl.js
//
// Double-entry General Ledger — a layer ALONGSIDE the existing org_funds
// cashbook. org_funds stays the operational record; every money event is also
// mirrored here as a balanced journal entry (debits === credits) against a
// chart of accounts, giving a trial balance, GL reports, and a basis for period
// close and bank reconciliation. Nothing in the existing modules has to change
// to keep working; posting is additive and idempotent.
//
// The mirror is CASH-BASIS: each org_funds row becomes one journal — Bank vs
// Income / Expense / Untransferred-Funds — because org_funds records realized
// cash movements. (Accrual postings — bill accruals, GST/TDS liabilities — are
// a later phase.)
import { FinanceError } from './tx';
import { readMinor } from './money';
import { assertPeriodOpen } from './periods';

// --- Standard chart of accounts (nonprofit-oriented). Control accounts; the
// per-billing-account subledger is carried on each line via `accountId`. ---
export const CHART_OF_ACCOUNTS = [
  // Assets (normal debit)
  { code: '1000', name: 'Bank & Cash', type: 'asset', normalBalance: 'debit' },
  { code: '1100', name: 'Untransferred Funds', type: 'asset', normalBalance: 'debit' },
  { code: '1200', name: 'Accounts Receivable', type: 'asset', normalBalance: 'debit' },
  { code: '1500', name: 'Fixed Assets', type: 'asset', normalBalance: 'debit' },
  { code: '1600', name: 'Accumulated Depreciation', type: 'asset', normalBalance: 'credit' }, // contra-asset
  // Liabilities (normal credit)
  { code: '2000', name: 'Accounts Payable', type: 'liability', normalBalance: 'credit' },
  { code: '2100', name: 'GST Payable', type: 'liability', normalBalance: 'credit' },
  { code: '2200', name: 'TDS Payable', type: 'liability', normalBalance: 'credit' },
  // Equity / Net assets (normal credit)
  { code: '3000', name: 'Unrestricted Net Assets', type: 'equity', normalBalance: 'credit' },
  { code: '3100', name: 'Restricted Net Assets', type: 'equity', normalBalance: 'credit' },
  { code: '3900', name: 'Opening Balance Equity', type: 'equity', normalBalance: 'credit' },
  // Income (normal credit)
  { code: '4000', name: 'Grant Income', type: 'income', normalBalance: 'credit' },
  { code: '4100', name: 'Donation Income', type: 'income', normalBalance: 'credit' },
  { code: '4200', name: 'Other Income', type: 'income', normalBalance: 'credit' },
  // Expense (normal debit)
  { code: '5000', name: 'Programs & Operations', type: 'expense', normalBalance: 'debit' },
  { code: '5100', name: 'Payroll', type: 'expense', normalBalance: 'debit' },
  { code: '5200', name: 'Marketing', type: 'expense', normalBalance: 'debit' },
  { code: '5300', name: 'Infrastructure & Software', type: 'expense', normalBalance: 'debit' },
  { code: '5400', name: 'Professional & Legal', type: 'expense', normalBalance: 'debit' },
  { code: '5500', name: 'Rent & Utilities', type: 'expense', normalBalance: 'debit' },
  { code: '5600', name: 'Travel', type: 'expense', normalBalance: 'debit' },
  { code: '5900', name: 'Depreciation Expense', type: 'expense', normalBalance: 'debit' },
  { code: '5990', name: 'Other Expense', type: 'expense', normalBalance: 'debit' },
];

export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];

const CHART_INDEX = new Map(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));

const BANK = '1000';
const POOL = '1100';

/** Map a funds inflowType to an income account code. */
export function incomeAccountForInflow(inflowType) {
  switch (inflowType) {
    case 'grant': return '4000';
    case 'donation': return '4100';
    default: return '4200';
  }
}

/** Map a funds expenseType to an expense (or asset, for capex) account code. */
export function expenseAccountForType(expenseType) {
  switch (expenseType) {
    case 'payroll': return '5100';
    case 'marketing': return '5200';
    case 'infrastructure':
    case 'software_saas': return '5300';
    case 'professional_services':
    case 'legal': return '5400';
    case 'rent':
    case 'utilities': return '5500';
    case 'travel': return '5600';
    case 'equipment_capex': return '1500'; // capitalized, not expensed
    case 'operations':
    case 'ops': return '5000';
    default: return '5990';
  }
}

/** INR minor units for a fund doc: prefer frozen inrMinor (multi-currency) else base amount. */
export function fundInrMinor(fund) {
  if (fund && fund.inrMinor != null && Number.isFinite(Number(fund.inrMinor))) {
    return Math.round(Number(fund.inrMinor));
  }
  return readMinor(fund, 'amount');
}

/** Idempotently upsert the standard chart into `gl_accounts`. */
export async function seedChartOfAccounts(db, session = null) {
  const col = db.collection('gl_accounts');
  const ops = CHART_OF_ACCOUNTS.map((a) => ({
    updateOne: {
      filter: { code: a.code },
      update: { $setOnInsert: { ...a, system: true, active: true, createdAt: new Date() } },
      upsert: true,
    },
  }));
  await col.bulkWrite(ops, { session: session || undefined, ordered: false });
  return CHART_OF_ACCOUNTS.length;
}

/** Load code -> account index from db (seeded chart + any custom accounts). */
export async function loadAccountIndex(db, session = null) {
  const rows = await db.collection('gl_accounts').find({}, { session: session || undefined }).toArray();
  const idx = new Map();
  // Embedded chart first (guarantees names even before seeding), db overrides.
  for (const a of CHART_OF_ACCOUNTS) idx.set(a.code, a);
  for (const r of rows) idx.set(r.code, r);
  return idx;
}

function normLineAmount(v) {
  const n = Math.round(Number(v) || 0);
  if (!Number.isFinite(n) || n < 0) throw new FinanceError('Journal line amounts must be non-negative integers', 400);
  return n;
}

/**
 * Post a balanced journal entry.
 *   entry = { date, description, source, reference, opId?, actor, meta?,
 *             lines: [{ accountCode, debitMinor, creditMinor, accountId?, memo? }] }
 * Options: { session, accountIndex } — accountIndex (code->account) validates
 * codes; defaults to the embedded chart. Idempotent on (source, reference) when
 * both are provided (relies on a unique index; also guards in-session).
 * Returns { entry, duplicate }.
 */
export async function postJournal(db, entry, { session = null, accountIndex = CHART_INDEX } = {}) {
  const { date, description, source = 'manual', reference = null, opId = null, actor = null, meta = null } = entry || {};
  const when = date instanceof Date ? date : new Date(date || Date.now());
  if (Number.isNaN(when.getTime())) throw new FinanceError('Invalid journal date', 400);

  const rawLines = Array.isArray(entry && entry.lines) ? entry.lines : [];
  if (rawLines.length < 2) throw new FinanceError('A journal entry needs at least two lines', 400);

  let debitTotal = 0;
  let creditTotal = 0;
  const lines = rawLines.map((l) => {
    const code = String(l.accountCode || '').trim();
    const acct = accountIndex.get(code);
    if (!acct) throw new FinanceError(`Unknown GL account: ${code || '(blank)'}`, 400);
    const debitMinor = normLineAmount(l.debitMinor);
    const creditMinor = normLineAmount(l.creditMinor);
    if ((debitMinor > 0) === (creditMinor > 0)) {
      throw new FinanceError('Each journal line must be exactly one of debit or credit', 400);
    }
    debitTotal += debitMinor;
    creditTotal += creditMinor;
    return {
      accountCode: code,
      accountName: acct.name,
      accountType: acct.type,
      debitMinor,
      creditMinor,
      accountId: l.accountId != null ? String(l.accountId) : null,
      memo: l.memo ? String(l.memo).slice(0, 500) : null,
    };
  });

  if (debitTotal !== creditTotal) {
    throw new FinanceError(`Journal not balanced: debits ${debitTotal} ≠ credits ${creditTotal} (paise)`, 400);
  }
  if (debitTotal <= 0) throw new FinanceError('Journal total must be positive', 400);

  // Reject posting into a closed fiscal period.
  await assertPeriodOpen(db, when, session);

  const col = db.collection('journal_entries');

  // Idempotency guard (best-effort in-session; the unique index is the backstop).
  if (source && reference) {
    const existing = await col.findOne({ source, reference }, { session: session || undefined, projection: { _id: 1 } });
    if (existing) return { entry: existing, duplicate: true };
  }

  const doc = {
    date: when,
    description: description ? String(description).slice(0, 1000) : '',
    source,
    reference: reference != null ? String(reference) : null,
    opId: opId != null ? String(opId) : null,
    lines,
    debitTotalMinor: debitTotal,
    creditTotalMinor: creditTotal,
    currency: 'INR',
    actor: actor || null,
    meta: meta || null,
    periodMonth: `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, '0')}`,
    createdAt: new Date(),
  };

  try {
    const res = await col.insertOne(doc, { session: session || undefined });
    return { entry: { _id: res.insertedId, ...doc }, duplicate: false };
  } catch (e) {
    if (e && e.code === 11000) {
      const existing = await col.findOne(
        source && reference ? { source, reference } : { opId },
        { session: session || undefined }
      );
      if (existing) return { entry: existing, duplicate: true };
    }
    throw e;
  }
}

/**
 * Derive the balanced lines mirroring a single org_funds row, or null if the
 * row carries no money. Bank (1000) is tagged with the billing accountId so the
 * per-account bank balance is recoverable.
 */
export function deriveJournalLinesForFund(fund) {
  const amt = fundInrMinor(fund);
  if (!amt || amt <= 0) return null;
  const accountId = fund.accountId != null ? String(fund.accountId) : null;
  const bank = (dc) => ({ accountCode: BANK, accountId, ...dc });
  const ref = String(fund.reference || '');
  const isTransfer = !!fund.isTransfer;

  // Pool (untransferred) movements.
  if (isTransfer && (ref.startsWith('untransferred:') || ref === 'untransferred:receive' || (fund.tags || []).includes('transfer'))) {
    if (fund.kind === 'in') {
      // Money arriving into a billing account from the pool (transfer / reversal).
      return { lines: [bank({ debitMinor: amt }), { accountCode: POOL, creditMinor: amt }], desc: 'Transfer from untransferred pool' };
    }
    // kind 'out' — money leaving a billing account into the pool.
    return { lines: [{ accountCode: POOL, debitMinor: amt }, bank({ creditMinor: amt })], desc: 'Move to untransferred pool' };
  }

  if (fund.kind === 'in') {
    const inc = incomeAccountForInflow(fund.inflowType);
    return { lines: [bank({ debitMinor: amt }), { accountCode: inc, creditMinor: amt }], desc: fund.title || 'Income' };
  }
  // kind 'out'
  const exp = expenseAccountForType(fund.expenseType);
  return { lines: [{ accountCode: exp, debitMinor: amt }, bank({ creditMinor: amt })], desc: fund.title || 'Expense' };
}

// A fund's GL mirror is VERSIONED so edits stay correct: each edit reverses the
// prior version and posts a fresh one. `glVersion` (default 1) lives on the
// org_funds doc; the journal reference embeds it, so every version is a distinct
// idempotent posting.
export function fundGlVersion(fund) {
  const v = fund && Number(fund.glVersion);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 1;
}

/**
 * Post (idempotently) the GL mirror of an org_funds row at its current version.
 * Skips deleted/zero rows. Pass `version` to override (used by the edit path).
 */
export async function postFundJournal(db, fund, { session = null, actor = null, version = null } = {}) {
  if (!fund || fund.deletedAt) return { skipped: true };
  const derived = deriveJournalLinesForFund(fund);
  if (!derived) return { skipped: true };
  const v = version != null ? version : fundGlVersion(fund);
  return postJournal(
    db,
    {
      date: fund.date || fund.createdAt || new Date(),
      description: derived.desc,
      source: 'org_funds',
      reference: `org_funds:${fund._id}#${v}`,
      opId: fund.opId ? `${fund.opId}#${v}` : null,
      actor: actor || fund.createdBy || null,
      meta: {
        accountId: fund.accountId != null ? String(fund.accountId) : null,
        kind: fund.kind,
        fundRestriction: fund.fundRestriction || null,
        fundId: String(fund._id),
        version: v,
      },
      lines: derived.lines,
    },
    { session }
  );
}

/**
 * Post a reversing journal for a fund version (on soft-delete or before an
 * edit re-post). Idempotent per (fund, version).
 */
export async function postFundReversal(db, fund, { session = null, actor = null, version = null } = {}) {
  if (!fund) return { skipped: true };
  const derived = deriveJournalLinesForFund(fund);
  if (!derived) return { skipped: true };
  const v = version != null ? version : fundGlVersion(fund);
  const flipped = derived.lines.map((l) => ({
    accountCode: l.accountCode,
    accountId: l.accountId,
    debitMinor: l.creditMinor ? l.creditMinor : 0,
    creditMinor: l.debitMinor ? l.debitMinor : 0,
  }));
  return postJournal(
    db,
    {
      date: fund.deletedAt || new Date(),
      description: `Reversal: ${derived.desc}`,
      source: 'org_funds_reversal',
      reference: `org_funds_rev:${fund._id}#${v}`,
      opId: fund.opId ? `rev:${fund.opId}#${v}` : null,
      actor,
      meta: { accountId: fund.accountId != null ? String(fund.accountId) : null, fundId: String(fund._id), reversalOf: v },
      lines: flipped,
    },
    { session }
  );
}

/**
 * Re-mirror a fund after an in-place edit: reverse the previous version and post
 * the updated document as the next version. `prevFund` is the pre-edit doc,
 * `newFund` the post-edit doc (already carrying the incremented glVersion).
 * Best-effort caller should wrap in try/catch.
 */
export async function remirrorEditedFund(db, prevFund, newFund, { session = null, actor = null } = {}) {
  const prevVersion = fundGlVersion(prevFund);
  await postFundReversal(db, prevFund, { session, actor, version: prevVersion });
  return postFundJournal(db, newFund, { session, actor });
}
