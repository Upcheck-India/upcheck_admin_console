// Recurrence math for vendor subscriptions. Kept in a co-located private module
// (not a route) so the create/edit routes and the generator share ONE source of
// truth for how a period rolls forward and how its dedupe key is computed.
//
// Calendar-month advancement uses day-overflow clamping (Jan 31 + 1 month ->
// Feb 28/29), mirroring the Compliance Calendar's addCalendarMonths.

export const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'annual'];
const FREQ_MONTHS = { monthly: 1, quarterly: 3, annual: 12 };

/** Add `n` calendar months, clamping the day to the target month's length. */
export function addCalendarMonths(date, n) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, max));
  return d;
}

/** Snap a date to `anchorDay` of its own month, clamped to that month's length. */
export function applyAnchorDay(date, anchorDay) {
  if (!anchorDay) return new Date(date);
  const d = new Date(date);
  const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(anchorDay, max));
  return d;
}

/**
 * The first billing date for a subscription, derived from startDate. For
 * monthly+ frequencies the day is normalized to anchorDay when supplied.
 */
export function initialDueDate(startDate, frequency, anchorDay) {
  const d = new Date(startDate);
  if (frequency === 'weekly') return d;
  return applyAnchorDay(d, anchorDay);
}

/** Advance one period forward from `date`. */
export function advanceByFrequency(date, frequency, anchorDay) {
  if (frequency === 'weekly') {
    const d = new Date(date);
    d.setDate(d.getDate() + 7);
    return d;
  }
  const months = FREQ_MONTHS[frequency] || 1;
  return applyAnchorDay(addCalendarMonths(date, months), anchorDay);
}

/** ISO-8601 week number + week-year for a date (Monday-based). */
function isoWeekParts(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

/**
 * Dedupe key for a period: 'YYYY-MM' for monthly/quarterly/annual (each period
 * lands in a distinct month, so the month key is unique per period), and
 * 'YYYY-Www' (ISO week) for weekly.
 */
export function periodKeyFor(date, frequency) {
  const d = new Date(date);
  if (frequency === 'weekly') {
    const { year, week } = isoWeekParts(d);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Add whole days (used for dueDate = billDate + dueInDays). */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + (Number(days) || 0));
  return d;
}
