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
