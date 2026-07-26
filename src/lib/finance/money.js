// src/lib/finance/money.js
// Canonical money handling for the finance module.
//
// Money is stored as INTEGER MINOR UNITS (paise) in an `amountMinor` field to
// eliminate IEEE-754 drift in storage and aggregation. For backward
// compatibility we ALSO keep the legacy `amount` field (rupees, a float) in
// sync on write, and all aggregations read paise via `minorExpr()` which falls
// back to `round(amount * 100)` for any legacy document that has not yet been
// backfilled (see scripts/migrate-finance-money.js). This makes the system
// correct both before and after the one-time migration is run.
import { FinanceError } from './tx';

/** Parse a user/rupee amount (number or numeric string) into integer paise. */
export function toMinor(value) {
  const n = typeof value === 'string' ? Number(value.replace(/,/g, '').trim()) : Number(value);
  if (!Number.isFinite(n)) throw new FinanceError('Invalid amount', 400);
  // Round to the nearest paisa (half away from zero) to avoid sub-paisa floats.
  const minor = Math.round(n * 100);
  if (!Number.isSafeInteger(minor)) throw new FinanceError('Amount out of range', 400);
  return minor;
}

/** Convert integer paise back to a rupee number (for the legacy `amount` field / display). */
export function fromMinor(minor) {
  const m = Number(minor) || 0;
  return m / 100;
}

/** Read canonical paise from a document, tolerating legacy (rupee-only) docs. */
export function readMinor(doc, field = 'amount') {
  if (!doc) return 0;
  const minorField = `${field}Minor`;
  if (doc[minorField] != null && Number.isFinite(Number(doc[minorField]))) {
    return Math.round(Number(doc[minorField]));
  }
  return Math.round((Number(doc[field]) || 0) * 100);
}

/**
 * Aggregation expression that yields integer paise for a field, tolerating
 * legacy documents. Use inside $group/$sum, e.g.:
 *   { $sum: minorExpr('amount') }
 */
export function minorExpr(field = 'amount') {
  return {
    $ifNull: [`$${field}Minor`, { $round: [{ $multiply: [`$${field}`, 100] }, 0] }],
  };
}

/**
 * Build the pair of fields to persist for a money value from a rupee input.
 * Spread into a document: `{ ...moneyFields('amount', input) }` →
 *   { amount: <rupees, 2dp>, amountMinor: <integer paise> }
 */
export function moneyFields(field, value) {
  const minor = toMinor(value);
  return { [field]: fromMinor(minor), [`${field}Minor`]: minor };
}

/** Format integer paise as an INR string with 2 decimals (Indian grouping). */
export function formatINRMinor(minor, { withSymbol = true } = {}) {
  const rupees = fromMinor(minor);
  return new Intl.NumberFormat('en-IN', {
    style: withSymbol ? 'currency' : 'decimal',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}
