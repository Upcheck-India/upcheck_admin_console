import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../../lib/serverAuth';
import {
  isAdmitted, weekKeyFor, wallToUtc, peakOverlap, parseHHMM,
} from '../../../../../../lib/scheduleBlocks';
import {
  loadBlock, withTeams, overlappingClaims, quotaUsage,
} from '../../../../../../lib/scheduleClaimStore';

const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

// GET /api/scheduling/blocks/[id]/availability?date=YYYY-MM-DD
// Free slots for one date in the block's timezone, already filtered by what
// THIS caller can still take — so the grid greys out what they have no
// allowance for rather than letting them click into a refusal.
export async function GET(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  try {
    const { id } = await params;
    const block = await loadBlock(db, id);
    if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const me = await withTeams(db, user);
    if (!isAdmitted(block, me)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    const tz = block.timezone;
    const win = block.window;
    const rules = block.rules;
    const gran = win.granularityMinutes;
    const winStart = parseHHMM(win.startTime);
    const winEnd = parseHHMM(win.endTime);

    const dayStart = wallToUtc(date, '00:00', tz);
    const dayEnd = new Date(dayStart.getTime() + 36 * 3600000);

    const open = block.status === 'open'
      && date >= block.startDate
      && (!block.endDate || date <= block.endDate)
      && win.days.includes(new Date(`${date}T00:00:00Z`).getUTCDay());

    if (!open) return NextResponse.json({ date, open: false, slots: [], quota: null });

    const dayKey = date;
    const weekKey = weekKeyFor(wallToUtc(date, win.startTime, tz), tz);
    const [claims, usage] = await Promise.all([
      overlappingClaims(db, block._id, dayStart, dayEnd),
      quotaUsage(db, block._id, user._id, dayKey, weekKey),
    ]);

    const dayLeft = rules.maxMinutesPerDay == null ? Infinity : rules.maxMinutesPerDay - usage.dayMinutes;
    const weekLeft = rules.maxMinutesPerWeek == null ? Infinity : rules.maxMinutesPerWeek - usage.weekMinutes;
    const claimsLeft = rules.maxClaimsPerDay == null ? Infinity : rules.maxClaimsPerDay - usage.dayClaims;
    const allowance = Math.min(dayLeft, weekLeft, rules.maxMinutes);
    const now = Date.now();
    const earliest = now + (rules.advanceNoticeMinutes || 0) * 60000;
    const latest = rules.horizonDays == null ? Infinity : now + rules.horizonDays * 86400000;

    // Slot boundaries, plus the leftover at the end of the window.
    //
    // A window seldom divides evenly by the slot size — 24 hours in 5-hour
    // slots leaves 4. That remainder used to generate nothing at all, so the
    // end of the day was unreachable however the block was configured.
    const edges = [];
    for (let m = winStart; m + gran <= winEnd; m += gran) edges.push([m, m + gran]);
    const consumed = edges.length ? edges[edges.length - 1][1] : winStart;
    const partialAllowed = win.allowPartialFinalSlot !== false;
    if (partialAllowed && consumed < winEnd) edges.push([consumed, winEnd]);

    const slots = [];
    for (const [m, mEnd] of edges) {
      const start = wallToUtc(date, hhmm(m), tz);
      const end = wallToUtc(date, hhmm(mEnd), tz);
      if (end.getTime() <= start.getTime()) continue;      // a DST gap swallowed this slot
      const span = mEnd - m;
      const isPartial = span !== gran;
      const held = peakOverlap(claims, start, end);
      const mine = claims.filter((c) => String(c.userId) === String(user._id))
        .some((c) => new Date(c.startTime) < end && new Date(c.endTime) > start);
      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: hhmm(m),
        // The client needs the end too. Deriving it from the next slot's start
        // breaks on the partial one, which is shorter than the rest.
        endLabel: hhmm(mEnd),
        minutes: span,
        partial: isPartial,
        held,
        free: held < rules.capacity,
        mine,
        claimable: held < rules.capacity
          && !mine
          && claimsLeft >= 1
          // The partial slot cannot meet a minimum longer than itself — that
          // is what it is for — so it is judged against its own length.
          && allowance >= (isPartial ? span : rules.minMinutes)
          && start.getTime() >= earliest
          && start.getTime() <= latest,
      });
    }

    return NextResponse.json({
      date,
      open: true,
      timezone: tz,
      granularityMinutes: gran,
      slots,
      quota: {
        ...usage,
        dayRemaining: dayLeft === Infinity ? null : Math.max(0, dayLeft),
        weekRemaining: weekLeft === Infinity ? null : Math.max(0, weekLeft),
        allowanceMinutes: allowance === Infinity ? null : Math.max(0, allowance),
      },
    });
  } catch (e) {
    console.error('availability GET', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
