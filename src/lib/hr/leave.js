// Shared constants + helpers for the Leave Management module.
export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

export const HOLIDAY_TYPES = ['public', 'optional', 'company'];

// Default leave types seeded the first time the module is used.
export const DEFAULT_LEAVE_TYPES = [
  { name: 'Casual Leave', code: 'CL', defaultAllocation: 12, color: '#3b82f6', paid: true, requiresApproval: true, carryForward: false },
  { name: 'Sick Leave', code: 'SL', defaultAllocation: 8, color: '#ef4444', paid: true, requiresApproval: true, carryForward: false },
  { name: 'Earned Leave', code: 'EL', defaultAllocation: 15, color: '#10b981', paid: true, requiresApproval: true, carryForward: true },
  { name: 'Unpaid Leave', code: 'LWP', defaultAllocation: 0, color: '#6b7280', paid: false, requiresApproval: true, carryForward: false },
];

// Default Indian national / gazetted holidays that fall on fixed Gregorian
// dates. These are seeded per-year the first time a year is viewed, and can be
// edited or deleted by an admin afterwards. Variable-date festivals
// (Diwali, Holi, Eid, etc.) shift every year, so they are intentionally left
// for admins to add per year rather than hardcoding incorrect dates.
export const DEFAULT_HOLIDAYS = [
  { month: 1, day: 1, name: "New Year's Day", type: 'optional', description: 'New Year' },
  { month: 1, day: 26, name: 'Republic Day', type: 'public', description: 'National holiday' },
  { month: 5, day: 1, name: 'Labour Day', type: 'optional', description: 'May Day' },
  { month: 8, day: 15, name: 'Independence Day', type: 'public', description: 'National holiday' },
  { month: 10, day: 2, name: 'Gandhi Jayanti', type: 'public', description: 'National holiday' },
  { month: 12, day: 25, name: 'Christmas Day', type: 'public', description: 'National holiday' },
];

// Build concrete default holiday documents for a given calendar year.
export function buildDefaultHolidaysForYear(year) {
  return DEFAULT_HOLIDAYS.map((h) => ({
    name: h.name,
    date: new Date(Date.UTC(year, h.month - 1, h.day)),
    type: h.type,
    recurring: true,
    description: h.description || '',
    source: 'default',
  }));
}

// Normalize a date to UTC midnight (date-only comparisons).
export function toDateOnly(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6; // Sun or Sat
}

// Count working days between start and end (inclusive), excluding weekends and
// the provided holiday date set (array of "YYYY-MM-DD" strings).
export function countWorkingDays(start, end, holidayKeys = [], halfDay = false) {
  const s = toDateOnly(start);
  const e = toDateOnly(end);
  if (!s || !e || e < s) return 0;
  const holidaySet = new Set(holidayKeys);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const key = cur.toISOString().slice(0, 10);
    if (!isWeekend(cur) && !holidaySet.has(key)) count += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  if (halfDay && s.getTime() === e.getTime() && count === 1) return 0.5;
  return count;
}

export function dateKey(value) {
  const d = toDateOnly(value);
  return d ? d.toISOString().slice(0, 10) : null;
}
