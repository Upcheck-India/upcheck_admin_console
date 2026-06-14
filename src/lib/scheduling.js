/**
 * Native scheduling/booking primitives (cal.diy-style) for Upcheck.
 *
 * Collections (db: "resources"):
 *   booking_event_types  — bookable meeting templates
 *   booking_availability  — one weekly-hours schedule per owner (by email)
 *   bookings              — confirmed/cancelled bookings
 *
 * Everything is timezone-correct: availability is defined in the owner's
 * timezone; slots are computed as absolute UTC instants so clients can render
 * them in the invitee's local timezone.
 */

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Default Mon–Fri 09:00–17:00.
export function defaultWeeklyHours() {
  return WEEKDAYS.map((_, day) => ({
    day,
    enabled: day >= 1 && day <= 5,
    start: '09:00',
    end: '17:00',
  }));
}

export function defaultAvailability() {
  return {
    timezone: 'UTC',
    weeklyHours: defaultWeeklyHours(),
  };
}

/** Slugify a string into a URL-safe handle. */
export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'meeting';
}

// "HH:MM" -> minutes since midnight (null if malformed).
function parseHHMM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

/**
 * Offset (ms) of `timeZone` at instant `date`, i.e. localWallTime - UTC.
 * Uses Intl to read the zone's wall clock, then diffs against the UTC instant.
 */
function tzOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = dtf.formatToParts(date).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - date.getTime();
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC Date.
 * (y, mo[1-12], d, h, mi) interpreted in the given zone.
 */
export function zonedWallTimeToUtc(y, mo, d, h, mi, timeZone) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  // Two-pass to settle DST boundaries.
  let offset = tzOffsetMs(new Date(guess), timeZone);
  let result = guess - offset;
  const offset2 = tzOffsetMs(new Date(result), timeZone);
  if (offset2 !== offset) result = guess - offset2;
  return new Date(result);
}

/** Weekday index (0=Sun) for a 'YYYY-MM-DD' calendar date. */
function weekdayOf(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

/**
 * Compute available start slots for a single day.
 *
 * @param {object} availability  { timezone, weeklyHours }
 * @param {number} durationMinutes
 * @param {string} dateStr  'YYYY-MM-DD' (owner-timezone calendar date)
 * @param {Array}  bookings  existing confirmed bookings [{ startTime, endTime }]
 * @param {Date}   now
 * @param {number} minNoticeMinutes  minimum lead time before a slot (default 0)
 * @returns {Array<{ start: string, end: string }>}  ISO UTC instants
 */
export function computeDaySlots(availability, durationMinutes, dateStr, bookings = [], now = new Date(), minNoticeMinutes = 0) {
  const tz = availability?.timezone || 'UTC';
  const rules = availability?.weeklyHours || defaultWeeklyHours();
  const duration = Number(durationMinutes) || 30;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return [];

  const day = weekdayOf(dateStr);
  const rule = rules.find((r) => r.day === day);
  if (!rule || !rule.enabled) return [];

  const startMin = parseHHMM(rule.start);
  const endMin = parseHHMM(rule.end);
  if (startMin === null || endMin === null || endMin <= startMin) return [];

  const [y, mo, d] = dateStr.split('-').map(Number);
  const earliest = now.getTime() + minNoticeMinutes * 60000;

  const busy = (bookings || [])
    .map((b) => [new Date(b.startTime).getTime(), new Date(b.endTime).getTime()])
    .filter(([a, c]) => Number.isFinite(a) && Number.isFinite(c));

  const slots = [];
  for (let t = startMin; t + duration <= endMin; t += duration) {
    const h = Math.floor(t / 60);
    const mi = t % 60;
    const start = zonedWallTimeToUtc(y, mo, d, h, mi, tz);
    const end = new Date(start.getTime() + duration * 60000);

    if (start.getTime() < earliest) continue;
    const overlaps = busy.some(([bs, be]) => start.getTime() < be && end.getTime() > bs);
    if (overlaps) continue;

    slots.push({ start: start.toISOString(), end: end.toISOString() });
  }
  return slots;
}
