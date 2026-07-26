// src/lib/finance/dates.js
// Timezone-consistent date handling for finance reporting. The organization
// operates in India, so all reporting "days"/"months" are computed in IST. The
// previous code computed date presets in SERVER-LOCAL time but grouped buckets
// in UTC, so period boundaries and bucket boundaries disagreed. Here, both the
// preset ranges AND the aggregation grouping use the same business timezone.

export const BUSINESS_TZ = 'Asia/Kolkata';
const TZ_OFFSET_MIN = 330; // IST = UTC+05:30

/** Current wall-clock parts (Y/M/D) in the business timezone. */
function nowPartsIST(now = new Date()) {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MIN * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(), // 0-based
    day: shifted.getUTCDate(),
    dow: shifted.getUTCDay(), // 0 Sun
  };
}

/** The UTC instant corresponding to IST midnight of the given Y/M/D. */
function istMidnightUTC(year, month, day) {
  return new Date(Date.UTC(year, month, day, 0, 0, 0) - TZ_OFFSET_MIN * 60000);
}
/** The UTC instant corresponding to IST end-of-day (23:59:59.999) of Y/M/D. */
function istEndOfDayUTC(year, month, day) {
  return new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - TZ_OFFSET_MIN * 60000);
}

/**
 * Resolve a date preset into a { start, end } pair of UTC Date instants whose
 * boundaries align to IST calendar days. Returns { start: null, end: null } for
 * unknown/absent presets.
 */
export function presetRange(preset, now = new Date()) {
  const p = nowPartsIST(now);
  const todayStart = istMidnightUTC(p.year, p.month, p.day);
  const todayEnd = istEndOfDayUTC(p.year, p.month, p.day);
  const dayMs = 86400000;
  switch (preset) {
    case 'today':
      return { start: todayStart, end: todayEnd };
    case 'last7':
      return { start: new Date(todayStart.getTime() - 6 * dayMs), end: todayEnd };
    case 'last30':
      return { start: new Date(todayStart.getTime() - 29 * dayMs), end: todayEnd };
    case 'thisWeek': {
      const diff = (p.dow + 6) % 7; // Monday start
      return { start: new Date(todayStart.getTime() - diff * dayMs), end: todayEnd };
    }
    case 'thisMonth':
      return { start: istMidnightUTC(p.year, p.month, 1), end: todayEnd };
    case 'thisQuarter': {
      const qMonth = Math.floor(p.month / 3) * 3;
      return { start: istMidnightUTC(p.year, qMonth, 1), end: todayEnd };
    }
    case 'thisYear':
      return { start: istMidnightUTC(p.year, 0, 1), end: todayEnd };
    default:
      return { start: null, end: null };
  }
}

/** Group-id date parts for a $group stage, evaluated in the business timezone. */
export function groupIdForBucket(groupBy, dateField = '$date', extra = {}) {
  const tz = BUSINESS_TZ;
  if (groupBy === 'day') {
    return { year: { $year: { date: dateField, timezone: tz } }, month: { $month: { date: dateField, timezone: tz } }, day: { $dayOfMonth: { date: dateField, timezone: tz } }, ...extra };
  }
  if (groupBy === 'week') {
    return { isoWeekYear: { $isoWeekYear: { date: dateField, timezone: tz } }, isoWeek: { $isoWeek: { date: dateField, timezone: tz } }, ...extra };
  }
  if (groupBy === 'year') {
    return { year: { $year: { date: dateField, timezone: tz } }, ...extra };
  }
  return { year: { $year: { date: dateField, timezone: tz } }, month: { $month: { date: dateField, timezone: tz } }, ...extra };
}

/** Format a stored date (or Y-M-D string) as an IST calendar date, avoiding UTC off-by-one. */
export function formatBusinessDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TZ, year: 'numeric', month: 'short', day: '2-digit' }).format(d);
}
