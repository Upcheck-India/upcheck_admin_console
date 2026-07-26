// Shared helpers for the budgets API routes (list + [id]). Lives outside the
// route files so Next.js route modules export only their HTTP handlers.
import { FinanceError } from '../../../../lib/finance/tx';
import { capString } from '../../../../lib/finance/auth';
import { toMinor, fromMinor, readMinor, minorExpr } from '../../../../lib/finance/money';

// Allowed enums — kept in sync with the Scope Type / Budget Type selects in
// BudgetPlanningEnhanced.js. Both POST and PUT validate against these.
export const BUDGET_SCOPE_TYPES = ['actual', 'mock', 'available', 'custom'];
export const BUDGET_TYPES = ['annual_fiscal', 'project', 'monthly', 'service', 'custom'];

// ---- Approval workflow (budget lifecycle only; maker-checker on money moves
// is out of scope — segregation of duties is deferred with the 1.12 tenancy
// decision). Legacy docs without the field are treated as 'draft'.
export const BUDGET_WORKFLOW_STATUSES = ['draft', 'submitted', 'approved', 'locked'];

// Allowed transitions: draft→submitted, submitted→draft (withdraw)|approved,
// approved→locked|draft (reopen), locked→approved (unlock). Same-status is a
// no-op and always allowed.
export const BUDGET_WORKFLOW_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['draft', 'approved'],
  approved: ['locked', 'draft'],
  locked: ['approved'],
};

/**
 * Normalize a fiscal-year input into { fiscalYearStart, fiscalYear }.
 * Accepts an int / '2025' / 'FY2025' / '2025-26' / 'FY2025-26' (separator
 * '-', '–' or '/'). Produces the canonical India FY label 'FY2025-26' plus the
 * integer start year. Unparseable input keeps the raw (capped) string as the
 * label with fiscalYearStart null, so legacy free-text values survive.
 */
export function normalizeFiscalYear(input) {
  if (input == null) return { fiscalYearStart: null, fiscalYear: '' };
  const raw = String(input).trim();
  if (!raw) return { fiscalYearStart: null, fiscalYear: '' };
  const m = raw.match(/^(?:FY\s*)?(\d{4})(?:\s*[-–/]\s*\d{2,4})?$/i);
  if (m) {
    const start = parseInt(m[1], 10);
    if (start >= 1990 && start <= 2100) {
      return { fiscalYearStart: start, fiscalYear: `FY${start}-${String((start + 1) % 100).padStart(2, '0')}` };
    }
  }
  return { fiscalYearStart: null, fiscalYear: raw.slice(0, 20) };
}

/**
 * Normalize a categories array into canonical storage form:
 * `allocated` as a rounded rupee NUMBER plus integer-paise `allocatedMinor`.
 * Rejects non-arrays (guarded), negative allocations, and non-numeric amounts.
 * Returns { list, totalMinor }.
 */
export function normalizeBudgetCategories(categories) {
  if (!Array.isArray(categories)) return { list: [], totalMinor: 0 };
  const list = [];
  let totalMinor = 0;
  for (const c of categories) {
    if (!c || typeof c !== 'object') continue;
    const minor = toMinor(c.allocated ?? 0); // throws FinanceError on non-numeric
    if (minor < 0) throw new FinanceError('Category allocation cannot be negative', 400);
    totalMinor += minor;
    list.push({
      category: capString(c.category, 100),
      categoryLabel: capString(c.categoryLabel, 120),
      allocated: fromMinor(minor),
      allocatedMinor: minor,
      notes: capString(c.notes, 1000),
    });
  }
  return { list, totalMinor };
}

/**
 * Aggregate real outflow from the org_funds ledger for one billing account,
 * grouped by expenseType (falling back to category), in integer paise. Returns
 * a Map<typeKey, spentMinor> used to join budget categories to actual spend.
 */
export async function computeAccountActuals(db, accountId) {
  const rows = await db.collection('org_funds').aggregate([
    { $match: { accountId, kind: 'out', deletedAt: { $exists: false } } },
    { $group: { _id: { $ifNull: ['$expenseType', { $ifNull: ['$category', 'other'] }] }, spentMinor: { $sum: minorExpr('amount') } } },
  ]).toArray();
  const map = new Map();
  for (const r of rows) {
    const key = r._id || 'other';
    map.set(key, (map.get(key) || 0) + (r.spentMinor || 0));
  }
  return map;
}

/**
 * Enrich a stored budget with budget-vs-actual figures. Each category gets
 * { allocated, allocatedMinor, actual, remaining, variancePct }; the budget gets
 * matching totals. Money is returned in rupees (via fromMinor) alongside the
 * canonical *Minor fields, and legacy (string/rupee-only) docs are tolerated
 * through readMinor. Response stays backward-compatible: existing rupee fields
 * (totalAllocated, categories[].allocated, baseAmount) keep their meaning.
 */
export function enrichBudgetWithActuals(budget, actualsMap) {
  const cats = Array.isArray(budget.categories) ? budget.categories : [];
  let allocTotalMinor = 0;
  let actualTotalMinor = 0;
  const categories = cats.map((c) => {
    const allocatedMinor = readMinor(c, 'allocated');
    const actualMinor = actualsMap.get(c.category) || 0;
    const remainingMinor = allocatedMinor - actualMinor;
    allocTotalMinor += allocatedMinor;
    actualTotalMinor += actualMinor;
    return {
      ...c,
      allocated: fromMinor(allocatedMinor),
      allocatedMinor,
      actual: fromMinor(actualMinor),
      actualMinor,
      remaining: fromMinor(remainingMinor),
      remainingMinor,
      variancePct: allocatedMinor > 0
        ? Math.round(((actualMinor - allocatedMinor) / allocatedMinor) * 10000) / 100
        : null,
    };
  });
  const totalAllocatedMinor = allocTotalMinor;
  const totalActualMinor = actualTotalMinor;
  const totalRemainingMinor = totalAllocatedMinor - totalActualMinor;
  const baseAmountMinor = budget.baseAmount != null || budget.baseAmountMinor != null
    ? readMinor(budget, 'baseAmount')
    : null;
  return {
    ...budget,
    categories,
    // Lifecycle + structured FY defaults for legacy documents.
    workflowStatus: budget.workflowStatus || 'draft',
    fiscalYearStart: budget.fiscalYearStart != null && Number.isFinite(Number(budget.fiscalYearStart))
      ? Number(budget.fiscalYearStart)
      : normalizeFiscalYear(budget.fiscalYear).fiscalYearStart,
    totalAllocated: fromMinor(totalAllocatedMinor),
    totalAllocatedMinor,
    totalActual: fromMinor(totalActualMinor),
    totalActualMinor,
    totalRemaining: fromMinor(totalRemainingMinor),
    totalRemainingMinor,
    totalVariancePct: totalAllocatedMinor > 0
      ? Math.round(((totalActualMinor - totalAllocatedMinor) / totalAllocatedMinor) * 10000) / 100
      : null,
    ...(baseAmountMinor != null ? { baseAmount: fromMinor(baseAmountMinor), baseAmountMinor } : {}),
  };
}
