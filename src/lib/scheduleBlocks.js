/**
 * Claimable time blocks — schema defaults, access resolution and the rules
 * engine.  Everything here is PURE: no database, no network, no `now` unless
 * you pass one.  The routes gather the facts (existing claims, quota sums) and
 * hand them to `validateClaim()`, which is why `scripts/test-claim-rules.cjs`
 * can exercise every rule without Mongo.
 *
 * Collections (db: "resources"):
 *   schedule_blocks       — the block, its window and its rules
 *   schedule_claims       — who took what
 *   schedule_claim_slots  — one row per granularity slot, unique per (slot, seat).
 *                           This is the race fix; see claimSlotKeys().
 *
 * All timezone maths goes through src/lib/scheduling.js, which is the only
 * DST-correct code in the repo.
 */

import { tzOffsetMs, zonedWallTimeToUtc, parseHHMM } from './scheduling.js';

export const MIN_GRANULARITY_MINUTES = 15;
export const CLAIM_STATUS = ['confirmed', 'pending', 'cancelled', 'rejected'];
export const BLOCK_STATUS = ['open', 'paused', 'closed'];

/* ───────────────────────────── zone helpers ───────────────────────────── */

const pad2 = (n) => String(n).padStart(2, '0');

/** Wall-clock parts of a UTC instant, read in `tz`. */
export function zonedParts(date, tz) {
  const local = new Date(date.getTime() + tzOffsetMs(date, tz));
  return {
    y: local.getUTCFullYear(),
    mo: local.getUTCMonth() + 1,
    d: local.getUTCDate(),
    h: local.getUTCHours(),
    mi: local.getUTCMinutes(),
    dow: local.getUTCDay(),           // 0 = Sunday
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

/** 'YYYY-MM-DD' for a UTC instant, in `tz`. */
export function dayKeyFor(date, tz) {
  const p = zonedParts(date, tz);
  return `${p.y}-${pad2(p.mo)}-${pad2(p.d)}`;
}

/** ISO-8601 week key, e.g. '2026-W36', for a UTC instant, in `tz`. */
export function weekKeyFor(date, tz) {
  const p = zonedParts(date, tz);
  // Thursday of this week decides the ISO year.
  const thu = new Date(Date.UTC(p.y, p.mo - 1, p.d));
  thu.setUTCDate(thu.getUTCDate() - ((thu.getUTCDay() + 6) % 7) + 3);
  const isoYear = thu.getUTCFullYear();
  // Thursday of ISO week 1 is the Thursday in the week containing Jan 4.
  const firstThu = new Date(Date.UTC(isoYear, 0, 4));
  firstThu.setUTCDate(firstThu.getUTCDate() - ((firstThu.getUTCDay() + 6) % 7) + 3);
  const week = 1 + Math.round((thu.getTime() - firstThu.getTime()) / 604800000);
  return `${isoYear}-W${pad2(week)}`;
}

/** 'YYYY-MM-DD' + 'HH:MM' in `tz` -> UTC Date. */
export function wallToUtc(dateStr, hhmm, tz) {
  const [y, mo, d] = String(dateStr).split('-').map(Number);
  const min = parseHHMM(hhmm);
  if (!Number.isFinite(y) || min === null) return null;
  return zonedWallTimeToUtc(y, mo, d, Math.floor(min / 60), min % 60, tz);
}

/* ───────────────────────────── normalisation ──────────────────────────── */

const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const nullableNum = (v) => (v === null || v === undefined || v === '' ? null : num(v, null));

/**
 * Coerce whatever the client sent into a legal block shape.  Used by POST and
 * PUT so a block can never be stored with rules the engine cannot read.
 * Returns { block } or { error: 'message' }.
 */
export function normalizeBlock(input = {}, base = null) {
  const src = { ...(base || {}), ...input };
  const title = String(src.title || '').trim();
  if (!title) return { error: 'Title is required' };

  const tz = String(src.timezone || 'Asia/Kolkata');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    return { error: `Unknown timezone "${tz}"` };
  }

  const startDate = String(src.startDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { error: 'startDate must be YYYY-MM-DD' };
  const endDate = src.endDate ? String(src.endDate).trim() : null;
  if (endDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return { error: 'endDate must be YYYY-MM-DD or empty' };
  if (endDate !== null && endDate < startDate) return { error: 'endDate cannot be before startDate' };

  const w = src.window || {};
  const days = Array.isArray(w.days)
    ? [...new Set(w.days.map(Number).filter((d) => d >= 0 && d <= 6))].sort()
    : [1, 2, 3, 4, 5];
  if (!days.length) return { error: 'Pick at least one weekday' };

  const startMin = parseHHMM(w.startTime || '09:00');
  const endMin = parseHHMM(w.endTime || '19:00');
  if (startMin === null || endMin === null) return { error: 'window.startTime / endTime must be HH:MM' };
  if (endMin <= startMin) return { error: 'window.endTime must be after startTime' };

  const granularityMinutes = num(w.granularityMinutes, 30);
  if (granularityMinutes < MIN_GRANULARITY_MINUTES) {
    return { error: `Slot granularity must be at least ${MIN_GRANULARITY_MINUTES} minutes` };
  }
  if ((endMin - startMin) % granularityMinutes !== 0 && granularityMinutes > endMin - startMin) {
    return { error: 'Slot granularity is longer than the bookable window' };
  }

  const r = src.rules || {};
  const rules = {
    minMinutes: num(r.minMinutes, granularityMinutes),
    maxMinutes: num(r.maxMinutes, endMin - startMin),
    maxMinutesPerDay: nullableNum(r.maxMinutesPerDay),
    maxMinutesPerWeek: nullableNum(r.maxMinutesPerWeek),
    maxClaimsPerDay: nullableNum(r.maxClaimsPerDay),
    capacity: Math.max(1, num(r.capacity, 1)),
    advanceNoticeMinutes: Math.max(0, num(r.advanceNoticeMinutes, 0)),
    horizonDays: nullableNum(r.horizonDays),
  };
  if (rules.minMinutes < granularityMinutes) rules.minMinutes = granularityMinutes;
  if (rules.maxMinutes < rules.minMinutes) return { error: 'Max claim length is below the minimum' };
  if (rules.minMinutes % granularityMinutes !== 0 || rules.maxMinutes % granularityMinutes !== 0) {
    return { error: 'Min and max claim length must be multiples of the slot granularity' };
  }

  const a = src.access || {};
  const access = {
    visibility: a.visibility === 'restricted' ? 'restricted' : 'org',
    allowRoles: (a.allowRoles || []).map(String),
    allowTeams: (a.allowTeams || []).map(String),
    allowUserIds: (a.allowUserIds || []).map(String),
    denyUserIds: (a.denyUserIds || []).map(String),
  };

  return {
    block: {
      title,
      description: String(src.description || '').trim(),
      icon: String(src.icon || 'CalendarClock'),
      color: /^#[0-9a-fA-F]{6}$/.test(src.color || '') ? src.color : '#0B6DC7',
      timezone: tz,
      startDate,
      endDate,
      window: {
        days,
        startTime: `${pad2(Math.floor(startMin / 60))}:${pad2(startMin % 60)}`,
        endTime: `${pad2(Math.floor(endMin / 60))}:${pad2(endMin % 60)}`,
        granularityMinutes,
      },
      rules,
      claimMode: src.claimMode === 'approval' ? 'approval' : 'instant',
      cancellableUntilMinutesBefore: nullableNum(src.cancellableUntilMinutesBefore),
      access,
      status: BLOCK_STATUS.includes(src.status) ? src.status : 'open',
    },
  };
}

/* ─────────────────────────────── access ───────────────────────────────── */

export function isBlockAdmin(block, user) {
  if (!user) return false;
  if (user.role === 'Admin' || user.role === 'Console admin') return true;
  return String(block.ownerId) === String(user._id);
}

/**
 * May this user see / claim in this block?
 * `user.teamIds` is a string array the route resolves from the teams collection.
 */
export function isAdmitted(block, user) {
  if (!user) return false;
  const uid = String(user._id);
  const access = block.access || {};
  if ((access.denyUserIds || []).map(String).includes(uid)) return false;   // deny always wins
  if (isBlockAdmin(block, user)) return true;
  if (access.visibility !== 'restricted') return true;

  if ((access.allowUserIds || []).map(String).includes(uid)) return true;
  if ((access.allowRoles || []).includes(user.role)) return true;
  const teamIds = (user.teamIds || []).map(String);
  if ((access.allowTeams || []).map(String).some((t) => teamIds.includes(t))) return true;
  return false;
}

/* ─────────────────────────── slots and overlap ────────────────────────── */

/**
 * Every granularity slot a claim occupies, as `${blockId}:${utcMillis}`.
 * Stepping in real milliseconds (not wall clock) keeps the key space
 * unambiguous across a DST transition.
 */
export function claimSlotKeys(blockId, start, end, granularityMinutes) {
  const step = granularityMinutes * 60000;
  const keys = [];
  for (let t = start.getTime(); t < end.getTime(); t += step) {
    keys.push({ slotKey: `${blockId}:${t}`, startTime: new Date(t) });
  }
  return keys;
}

/**
 * Peak number of simultaneous holders inside [start, end) given existing
 * intervals.  Half-open: touching intervals do not overlap.
 */
export function peakOverlap(intervals, start, end) {
  const s = start.getTime();
  const e = end.getTime();
  const edges = [];
  for (const iv of intervals) {
    const a = Math.max(s, new Date(iv.startTime).getTime());
    const b = Math.min(e, new Date(iv.endTime).getTime());
    if (a < b) { edges.push([a, 1], [b, -1]); }
  }
  edges.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  let cur = 0;
  let peak = 0;
  for (const [, delta] of edges) {
    cur += delta;
    if (cur > peak) peak = cur;
  }
  return peak;
}

/* ──────────────────────────── the rules engine ────────────────────────── */

const fail = (code, message) => ({ ok: false, code, message });

/**
 * The ordered rule checks.  Cheap refusals first; nothing here touches the DB.
 *
 * @param {object}  block     a normalised schedule_blocks doc
 * @param {object}  user      { _id, role, teamIds }
 * @param {Date}    start     UTC instant
 * @param {Date}    end       UTC instant
 * @param {Date}    now
 * @param {Array}   overlapping  existing CONFIRMED claims that overlap [start,end)
 * @param {object}  usage     { dayMinutes, weekMinutes, dayClaims } for this
 *                            user in this block, excluding the claim under test
 * @returns {{ok:true, minutes, dayKey, weekKey}|{ok:false, code, message}}
 */
export function validateClaim({ block, user, start, end, now = new Date(), overlapping = [], usage = {} }) {
  if (!block) return fail('no_block', 'Block not found');
  const tz = block.timezone || 'UTC';
  const win = block.window || {};
  const rules = block.rules || {};

  if (!(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return fail('bad_time', 'Start and end must be valid times');
  }

  const sp = zonedParts(start, tz);
  const ep = zonedParts(end, tz);
  const dayKey = dayKeyFor(start, tz);
  const weekKey = weekKeyFor(start, tz);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);

  // 1 — block is open, and this date is inside its lifetime.
  if (block.status !== 'open') return fail('block_closed', `This block is ${block.status}`);
  if (dayKey < block.startDate) return fail('before_start', `This block opens on ${block.startDate}`);
  if (block.endDate && dayKey > block.endDate) return fail('after_end', `This block ended on ${block.endDate}`);

  // 2 — claimant is admitted (deny wins, checked inside isAdmitted).
  if (!isAdmitted(block, user)) return fail('not_admitted', 'You do not have access to this block');

  // 3 — times are well-formed.
  if (end.getTime() <= start.getTime()) return fail('bad_range', 'End must be after start');
  const winStart = parseHHMM(win.startTime);
  const winEnd = parseHHMM(win.endTime);
  const gran = Number(win.granularityMinutes) || 30;
  if (winStart === null || winEnd === null) return fail('bad_window', 'Block has an invalid bookable window');
  if ((sp.minutes - winStart) % gran !== 0 || (ep.minutes - winStart) % gran !== 0) {
    return fail('granularity', `Times must land on ${gran}-minute boundaries from ${win.startTime}`);
  }
  if (minutes < rules.minMinutes) return fail('too_short', `Minimum claim is ${rules.minMinutes} minutes`);
  if (minutes > rules.maxMinutes) return fail('too_long', `Maximum claim is ${rules.maxMinutes} minutes`);

  // 4 — inside the bookable window. A claim may not straddle midnight.
  if (!(win.days || []).includes(sp.dow)) return fail('closed_day', 'This block is not open on that day');
  if (dayKeyFor(end, tz) !== dayKey && ep.minutes !== 0) {
    return fail('straddles_midnight', 'A claim cannot cross midnight');
  }
  const endMinutes = dayKeyFor(end, tz) === dayKey ? ep.minutes : 1440;
  if (sp.minutes < winStart || endMinutes > winEnd) {
    return fail('outside_window', `This block is claimable ${win.startTime}–${win.endTime}`);
  }

  // 5 — notice and horizon.
  const notice = rules.advanceNoticeMinutes || 0;
  if (start.getTime() < now.getTime() + notice * 60000) {
    return fail('too_soon', notice ? `Claims need ${notice} minutes' notice` : 'That time has already passed');
  }
  if (rules.horizonDays !== null && rules.horizonDays !== undefined) {
    if (start.getTime() > now.getTime() + rules.horizonDays * 86400000) {
      return fail('too_far', `Claims can only be made ${rules.horizonDays} days ahead`);
    }
  }

  // 6 — capacity. The unique slot index is the authority; this is the friendly
  //     refusal that usually catches it first.
  const capacity = Math.max(1, rules.capacity || 1);
  if (peakOverlap(overlapping, start, end) >= capacity) {
    return fail('taken', capacity === 1 ? 'Someone already holds part of that range' : 'That range is fully booked');
  }

  // 7 — personal quota, in the block's timezone.
  const dayMinutes = usage.dayMinutes || 0;
  const weekMinutes = usage.weekMinutes || 0;
  const dayClaims = usage.dayClaims || 0;
  if (rules.maxMinutesPerDay != null && dayMinutes + minutes > rules.maxMinutesPerDay) {
    return fail('over_day_quota', `That would put you over your ${rules.maxMinutesPerDay} minutes for ${dayKey} (${dayMinutes} already taken)`);
  }
  if (rules.maxMinutesPerWeek != null && weekMinutes + minutes > rules.maxMinutesPerWeek) {
    return fail('over_week_quota', `That would put you over your ${rules.maxMinutesPerWeek} minutes for ${weekKey} (${weekMinutes} already taken)`);
  }
  if (rules.maxClaimsPerDay != null && dayClaims + 1 > rules.maxClaimsPerDay) {
    return fail('over_claim_count', `You may only make ${rules.maxClaimsPerDay} claims a day here`);
  }

  return { ok: true, minutes, dayKey, weekKey };
}

/** Plain-English echo of the rules, shown under the block editor. */
export function describeRules(block) {
  const r = block?.rules || {};
  const h = (m) => (m % 60 === 0 ? `${m / 60} h` : `${m} min`);
  const bits = [`each person may take ${h(r.minMinutes)} to ${h(r.maxMinutes)}`];
  if (r.maxMinutesPerDay != null) bits.push(`up to ${h(r.maxMinutesPerDay)} a day`);
  if (r.maxMinutesPerWeek != null) bits.push(`and ${h(r.maxMinutesPerWeek)} a week`);
  if (r.maxClaimsPerDay != null) bits.push(`in at most ${r.maxClaimsPerDay} claims a day`);
  const cap = (r.capacity || 1) > 1 ? `, ${r.capacity} people at a time` : '';
  return `${bits.join(', ')}${cap}.`;
}
