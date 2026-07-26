// src/lib/finance/periods.js
//
// Fiscal periods and period close/lock. A period is an explicit document in
// `fiscal_periods`; once its status is 'closed', no journal entry may be posted
// with a date inside it (the ledger for that period is frozen — corrections go
// in a later open period as reversing entries).
//
// India fiscal year runs 1 April → 31 March. Periods are typically monthly.
import { FinanceError } from './tx';

export const INDIA_FY_START_MONTH = 3; // April (0-indexed: Jan=0 … Apr=3)

/** Fiscal-year START year for a date (India FY: Apr–Mar). Jan–Mar → prior year. */
export function fyStartForDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  return d.getMonth() >= INDIA_FY_START_MONTH ? y : y - 1;
}

/** 'FY2026-27' label from a start year. */
export function fyLabel(startYear) {
  const s = Number(startYear);
  if (!Number.isFinite(s)) return null;
  return `FY${s}-${String((s + 1) % 100).padStart(2, '0')}`;
}

/** UTC-safe [start, endExclusive) bounds for a month key 'YYYY-MM'. */
export function monthBounds(year, monthIndex0) {
  const start = new Date(Date.UTC(year, monthIndex0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex0 + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

/** The 12 monthly period descriptors for an India fiscal year (Apr..Mar). */
export function monthlyPeriodsForFY(fyStart) {
  const s = Number(fyStart);
  const out = [];
  for (let i = 0; i < 12; i += 1) {
    const monthIndex = INDIA_FY_START_MONTH + i;
    const year = s + Math.floor(monthIndex / 12);
    const m0 = monthIndex % 12;
    const { start, end } = monthBounds(year, m0);
    const key = `${year}-${String(m0 + 1).padStart(2, '0')}`;
    const label = start.toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    out.push({ key, label, fyStart: s, fyLabel: fyLabel(s), start, end });
  }
  return out;
}

/**
 * Throw FinanceError(409) if `date` falls inside a CLOSED fiscal period.
 * If no closed period covers the date, posting is allowed. Runs inside the
 * caller's transaction session when provided.
 */
export async function assertPeriodOpen(db, date, session = null) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new FinanceError('Invalid posting date', 400);
  const closed = await db.collection('fiscal_periods').findOne(
    { status: 'closed', start: { $lte: d }, end: { $gt: d } },
    { session: session || undefined, projection: { key: 1, label: 1 } }
  );
  if (closed) {
    throw new FinanceError(
      `Accounting period ${closed.label || closed.key} is closed; post corrections in an open period.`,
      409
    );
  }
  return true;
}

/** The period document containing a date (open or closed), or null. */
export async function periodContaining(db, date, session = null) {
  const d = date instanceof Date ? date : new Date(date);
  return db.collection('fiscal_periods').findOne(
    { start: { $lte: d }, end: { $gt: d } },
    { session: session || undefined }
  );
}
