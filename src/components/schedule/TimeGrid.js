'use client';

/**
 * One grid, three views. No calendar library is installed and none should be
 * added — this is grid maths, and day, week and month all read from it.
 *
 * Everything is rendered in `timezone` (the block's, unless the viewer has
 * overridden the display zone). Claims arrive as UTC instants and are placed
 * by their wall-clock position in that zone, so a claim never drifts an hour
 * across a DST boundary the way the repo's older calendars do.
 *
 * WHAT THE FIRST VERSION GOT WRONG, AND WHY IT IS DIFFERENT NOW
 * ------------------------------------------------------------
 *  - Concurrent claims were drawn at the same left/right and covered each
 *    other. On a block with capacity above one — the whole point of having a
 *    capacity — the grid showed one holder and hid the rest. Claims are packed
 *    into lanes now, so every holder of a slot is visible.
 *  - There was no current-time line, which is the first thing anyone looks for
 *    when deciding whether a slot is still takeable.
 *  - Dragging was bound to mouse events, so selecting a range was impossible
 *    on a tablet. Pointer events cover both.
 *  - A drag gave no readout, so you found out what you had selected only after
 *    letting go and reading a dialog.
 *  - 26px rows with 10px type made a five-hour claim a sliver of clipped text.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { zonedParts, parseHHMM } from '../../lib/scheduleBlocks';

const ROW_H = 34;
const AXIS_W = 60;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n) => String(n).padStart(2, '0');
export const hhmm = (mins) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;

/**
 * The clock a person reads, as opposed to the one the data is stored in.
 *
 * Times are held, sent and compared as 24-hour "HH:MM" everywhere — that is
 * the wire format and it never changes. This is display only, and it is a
 * preference because half the world reads one and half the other.
 *
 * 24:00 stays "12:00 AM" rather than becoming "0:00 AM": it is midnight at the
 * end of the day, and the surrounding label already says which day.
 */
export function displayTime(mins, use12h) {
  if (!use12h) return hhmm(mins);
  const total = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad2(m)} ${suffix}`;
}

/** The same, for an "HH:MM" string rather than a minute count. */
export function displayHHMM(value, use12h) {
  if (!use12h || !value) return value;
  const [h, m] = String(value).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return displayTime(h * 60 + m, true);
}

/** Remembered per browser: a clock preference is not worth a server round-trip. */
export const TIME_FORMAT_KEY = 'upcheck_schedule_time_format';

export function readTimeFormatPref() {
  if (typeof window === 'undefined') return '24h';
  try {
    return window.localStorage.getItem(TIME_FORMAT_KEY) === '12h' ? '12h' : '24h';
  } catch {
    // Private mode and blocked storage both throw rather than return null.
    return '24h';
  }
}

export function writeTimeFormatPref(value) {
  try {
    window.localStorage.setItem(TIME_FORMAT_KEY, value);
  } catch {
    // A preference that cannot be saved is still worth honouring this session.
  }
}

/** "2h 30m" — durations read faster than a minute count. */
export function humanMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** 'YYYY-MM-DD' + n days, plain calendar arithmetic. */
export function shiftDay(dateStr, days) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
}
export function weekdayOf(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}
/** Sunday-anchored week containing `dateStr`. */
export function weekOf(dateStr) {
  const start = shiftDay(dateStr, -weekdayOf(dateStr));
  return Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
}
/** The 42-cell month grid containing `dateStr`. */
export function monthGrid(dateStr) {
  const [y, mo] = dateStr.split('-').map(Number);
  const first = `${y}-${pad2(mo)}-01`;
  const start = shiftDay(first, -weekdayOf(first));
  return Array.from({ length: 42 }, (_, i) => shiftDay(start, i));
}

/** Where a claim sits in `tz`: which calendar day, and which wall minutes. */
function placeClaim(claim, tz) {
  const s = zonedParts(new Date(claim.startTime), tz);
  const e = zonedParts(new Date(claim.endTime), tz);
  const dateStr = `${s.y}-${pad2(s.mo)}-${pad2(s.d)}`;
  const endDate = `${e.y}-${pad2(e.mo)}-${pad2(e.d)}`;
  // A claim cannot straddle midnight, so an end on the next day is exactly 24:00.
  return { dateStr, startMin: s.minutes, endMin: endDate === dateStr ? e.minutes : 1440 };
}

/**
 * Pack a day's claims into lanes so overlapping ones sit side by side.
 *
 * Greedy by start time: a claim takes the first lane whose last occupant has
 * already ended. That is the standard calendar layout and it is O(n·lanes),
 * which at the scale of one day's claims is nothing.
 */
function packLanes(items) {
  const sorted = [...items].sort((a, b) => a.at.startMin - b.at.startMin || a.at.endMin - b.at.endMin);
  const laneEnds = [];
  const placed = sorted.map((c) => {
    let lane = laneEnds.findIndex((end) => end <= c.at.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = c.at.endMin;
    return { ...c, lane };
  });
  return { placed, lanes: Math.max(1, laneEnds.length) };
}

/** Stable, readable colour per holder so "who has it" reads at a glance. */
const HOLDER_HUES = [212, 152, 28, 340, 264, 190, 88, 8];
export function holderTint(userId) {
  let h = 0;
  for (const ch of String(userId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = HOLDER_HUES[h % HOLDER_HUES.length];
  return {
    bg: `hsl(${hue} 72% 95%)`,
    bgStrong: `hsl(${hue} 68% 90%)`,
    border: `hsl(${hue} 58% 60%)`,
    text: `hsl(${hue} 62% 26%)`,
  };
}

/** Today's date in the display zone — "today" is a local question. */
function todayIn(tz) {
  const p = zonedParts(new Date(), tz);
  return `${p.y}-${pad2(p.mo)}-${pad2(p.d)}`;
}
function nowMinutesIn(tz) {
  return zonedParts(new Date(), tz).minutes;
}

export default function TimeGrid({
  view = 'week',
  use12h = false,
  anchorDate,
  timezone = 'UTC',
  window: win,
  claims = [],
  currentUserId,
  accent = '#0B6DC7',
  onSelectRange,
  onClaimClick,
}) {
  const [drag, setDrag] = useState(null); // { col, a, b } while selecting
  const dragging = useRef(false);

  // Re-render the now-line on a slow tick rather than on every animation
  // frame; a minute of drift on a scheduling grid is invisible.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const winStart = parseHHMM(win?.startTime || '09:00') ?? 540;
  const winEnd = parseHHMM(win?.endTime || '19:00') ?? 1140;
  const gran = win?.granularityMinutes || 30;
  // A window seldom divides evenly by the slot size. The remainder gets its
  // own shorter row at the bottom rather than being dropped — dropping it is
  // what made the end of a 5-hour-slot day unreachable.
  const fullRows = Math.max(0, Math.floor((winEnd - winStart) / gran));
  const remainder = (winEnd - winStart) - fullRows * gran;
  const hasPartial = win?.allowPartialFinalSlot !== false && remainder > 0;
  const rows = Math.max(1, fullRows + (hasPartial ? 1 : 0));
  // Rows are laid out in minutes-to-pixels, so the short one is short.
  const rowHeight = (i) => (i < fullRows ? ROW_H : (remainder / gran) * ROW_H);
  const rowTop = (i) => Math.min(i, fullRows) * ROW_H;
  // Minutes at the end of row i, never past the window's own end.
  const rowEndMin = (i) => Math.min(winStart + (i + 1) * gran, winEnd);
  const openDays = win?.days || [0, 1, 2, 3, 4, 5, 6];

  const today = todayIn(timezone);
  const nowMin = nowMinutesIn(timezone);

  const dates = useMemo(() => {
    if (view === 'day') return [anchorDate];
    if (view === 'month') return monthGrid(anchorDate);
    return weekOf(anchorDate);
  }, [view, anchorDate]);

  const byDate = useMemo(() => {
    const m = {};
    for (const c of claims) {
      const at = placeClaim(c, timezone);
      (m[at.dateStr] ||= []).push({ ...c, at });
    }
    return m;
  }, [claims, timezone]);

  /* ── month: a real list per day, not a density blob ──────────────────── */
  if (view === 'month') {
    const month = anchorDate.slice(0, 7);
    return (
      <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/80">
          {DOW.map((d) => (
            <div key={d} className="px-2 py-2 text-[11px] font-semibold text-gray-500 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dates.map((date, i) => {
            const items = byDate[date] || [];
            const outside = !date.startsWith(month);
            const closed = !openDays.includes(weekdayOf(date));
            const isToday = date === today;
            return (
              <div
                key={date}
                className={`min-h-[104px] p-1.5 border-gray-100 ${i % 7 !== 6 ? 'border-r' : ''} ${
                  i < 35 ? 'border-b' : ''
                } ${outside ? 'bg-gray-50/60' : closed ? 'bg-gray-50/30' : 'bg-white'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`grid place-items-center h-5 min-w-[20px] px-1 rounded-full text-[11px] font-semibold tabular-nums ${
                      isToday
                        ? 'text-white'
                        : outside
                          ? 'text-gray-300'
                          : 'text-gray-600'
                    }`}
                    style={isToday ? { background: accent } : undefined}
                  >
                    {Number(date.slice(8))}
                  </span>
                  {!closed && !outside && (
                    <button
                      type="button"
                      onClick={() => onSelectRange?.({ date, jumpToDay: true })}
                      className="text-[10px] text-gray-400 hover:text-blue-600 px-1 rounded"
                      title="Open this day"
                    >
                      open
                    </button>
                  )}
                </div>

                <div className="space-y-0.5">
                  {items.slice(0, 3).map((c) => {
                    const t = holderTint(c.userId);
                    const mine = String(c.userId) === String(currentUserId);
                    return (
                      <button
                        type="button"
                        key={c._id}
                        onClick={() => onClaimClick?.(c)}
                        title={`${c.userName} · ${displayTime(c.at.startMin, use12h)}–${displayTime(c.at.endMin, use12h)}`}
                        className="w-full text-left truncate rounded px-1 py-0.5 text-[10px] font-medium border block"
                        style={{
                          background: t.bg,
                          borderColor: t.border,
                          color: t.text,
                          borderStyle: c.status === 'pending' ? 'dashed' : 'solid',
                          opacity: c.status === 'cancelled' ? 0.45 : 1,
                        }}
                      >
                        <span className="tabular-nums opacity-70">{displayTime(c.at.startMin, use12h)}</span>{' '}
                        {mine ? 'You' : c.userName}
                      </button>
                    );
                  })}
                  {items.length > 3 && (
                    <button
                      type="button"
                      onClick={() => onSelectRange?.({ date, jumpToDay: true })}
                      className="text-[10px] text-gray-400 hover:text-blue-600 px-1"
                    >
                      +{items.length - 3} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── day / week ───────────────────────────────────────────────────────── */

  const commit = () => {
    if (!drag) {
      dragging.current = false;
      return;
    }
    const a = Math.min(drag.a, drag.b);
    const b = Math.max(drag.a, drag.b);
    const date = dates[drag.col];
    setDrag(null);
    dragging.current = false;
    onSelectRange?.({
      date,
      startTime: hhmm(winStart + a * gran),
      endTime: hhmm(rowEndMin(b)),
    });
  };

  const dragLabel = drag
    ? (() => {
        const a = Math.min(drag.a, drag.b);
        const b = Math.max(drag.a, drag.b);
        const startMin = winStart + a * gran;
        const endMin = rowEndMin(b);
        return `${displayTime(startMin, use12h)} – ${displayTime(endMin, use12h)} · ${humanMinutes(endMin - startMin)}`;
      })()
    : null;

  const gridHeight = fullRows * ROW_H + (hasPartial ? (remainder / gran) * ROW_H : 0);
  const nowVisible = nowMin >= winStart && nowMin <= winEnd;
  const nowTop = ((nowMin - winStart) / gran) * ROW_H;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div
        className="overflow-x-auto"
        onPointerUp={commit}
        onPointerLeave={() => {
          dragging.current = false;
          setDrag(null);
        }}
      >
        <div
          className="min-w-[600px] select-none"
          style={{ display: 'grid', gridTemplateColumns: `${AXIS_W}px repeat(${dates.length}, minmax(104px, 1fr))` }}
        >
          {/* ── header ─────────────────────────────────────────────────── */}
          <div className="sticky left-0 z-20 bg-gray-50/90 backdrop-blur border-b border-r border-gray-200 px-2 py-2">
            <span className="text-[10px] font-medium text-gray-400">
              {MONTHS[Number(dates[0].slice(5, 7)) - 1]}
            </span>
          </div>
          {dates.map((date) => {
            const closed = !openDays.includes(weekdayOf(date));
            const isToday = date === today;
            return (
              <div
                key={date}
                className={`border-b border-gray-200 px-2 py-2 text-center ${
                  isToday ? 'bg-blue-50/70' : 'bg-gray-50/80'
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {DOW[weekdayOf(date)]}
                </div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span
                    className={`grid place-items-center h-6 min-w-[24px] px-1 rounded-full text-sm font-semibold tabular-nums ${
                      isToday ? 'text-white' : closed ? 'text-gray-300' : 'text-gray-700'
                    }`}
                    style={isToday ? { background: accent } : undefined}
                  >
                    {Number(date.slice(8))}
                  </span>
                </div>
                {closed && <div className="text-[10px] text-gray-400 mt-0.5">closed</div>}
              </div>
            );
          })}

          {/* ── time axis ──────────────────────────────────────────────── */}
          <div
            className="sticky left-0 z-10 bg-white border-r border-gray-200"
            style={{ height: gridHeight, position: 'relative' }}
          >
            {Array.from({ length: rows + 1 }, (_, r) => {
              const mins = winStart + r * gran;
              if (mins % 60 !== 0) return null;
              // The first label would sit half outside the grid if it were
              // centred on its line like the rest, so it hangs below instead.
              const first = r === 0;
              return (
                <span
                  key={r}
                  className="absolute right-2 text-[11px] tabular-nums text-gray-400"
                  style={{ top: r * ROW_H, transform: first ? 'none' : 'translateY(-50%)' }}
                >
                  {displayTime(mins, use12h)}
                </span>
              );
            })}
            {nowVisible && (
              <span
                className="absolute right-1 px-1 rounded text-[10px] font-semibold text-white tabular-nums"
                style={{ top: nowTop, transform: 'translateY(-50%)', background: '#C42B2B' }}
              >
                {displayTime(nowMin, use12h)}
              </span>
            )}
          </div>

          {/* ── day columns ────────────────────────────────────────────── */}
          {dates.map((date, col) => {
            const closed = !openDays.includes(weekdayOf(date));
            const isToday = date === today;
            const { placed, lanes } = packLanes(byDate[date] || []);

            return (
              <div
                key={date}
                className={`relative border-l border-gray-100 ${closed ? 'bg-gray-50/60' : isToday ? 'bg-blue-50/20' : ''}`}
                style={{ height: gridHeight }}
              >
                {/* hour lines, drawn once as a background rather than per row */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(to bottom,' +
                      `transparent 0, transparent ${ROW_H - 1}px,` +
                      `rgb(243 244 246) ${ROW_H - 1}px, rgb(243 244 246) ${ROW_H}px)`,
                  }}
                />

                {/* drag targets */}
                {!closed &&
                  Array.from({ length: rows }, (_, r) => {
                    const selected =
                      drag && drag.col === col && r >= Math.min(drag.a, drag.b) && r <= Math.max(drag.a, drag.b);
                    return (
                      <div
                        key={r}
                        onPointerDown={(e) => {
                          e.currentTarget.releasePointerCapture?.(e.pointerId);
                          dragging.current = true;
                          setDrag({ col, a: r, b: r });
                        }}
                        onPointerEnter={() => {
                          if (dragging.current) {
                            setDrag((d) => (d && d.col === col ? { ...d, b: r } : d));
                          }
                        }}
                        className={`absolute left-0 right-0 cursor-cell transition-colors ${
                          selected ? '' : 'hover:bg-blue-100/40'
                        }`}
                        style={{
                          top: rowTop(r),
                          height: rowHeight(r),
                          background: selected ? `${accent}33` : undefined,
                          touchAction: 'none',
                        }}
                      />
                    );
                  })}

                {/* live readout, pinned to the selection */}
                {drag && drag.col === col && dragLabel && (
                  <div
                    className="absolute left-1 right-1 z-30 pointer-events-none rounded-md px-2 py-1 text-[11px] font-semibold text-white shadow-lg text-center tabular-nums"
                    style={{ top: Math.min(drag.a, drag.b) * ROW_H - 26, background: accent }}
                  >
                    {dragLabel}
                  </div>
                )}

                {/* now-line, on today's column only */}
                {isToday && nowVisible && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                    style={{ top: nowTop }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full -ml-[3px]" style={{ background: '#C42B2B' }} />
                    <span className="h-px flex-1" style={{ background: '#C42B2B' }} />
                  </div>
                )}

                {/* claims, in lanes so concurrent holders are all visible */}
                {placed.map((c) => {
                  const top = ((c.at.startMin - winStart) / gran) * ROW_H;
                  const height = Math.max(
                    22,
                    ((c.at.endMin - c.at.startMin) / gran) * ROW_H - 3,
                  );
                  const t = holderTint(c.userId);
                  const mine = String(c.userId) === String(currentUserId);
                  const laneW = 100 / lanes;
                  const tall = height >= 44;

                  return (
                    <button
                      type="button"
                      key={c._id}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onClaimClick?.(c)}
                      title={`${c.userName} · ${displayTime(c.at.startMin, use12h)}–${displayTime(c.at.endMin, use12h)} · ${humanMinutes(
                        c.at.endMin - c.at.startMin,
                      )}${c.status === 'pending' ? ' (awaiting approval)' : ''}`}
                      className="absolute z-10 rounded-lg px-2 py-1 text-left overflow-hidden leading-tight shadow-sm hover:shadow-md hover:z-20 transition-shadow"
                      style={{
                        top: Math.max(0, top) + 1,
                        height,
                        left: `calc(${c.lane * laneW}% + 3px)`,
                        width: `calc(${laneW}% - 6px)`,
                        background: mine ? t.bgStrong : t.bg,
                        color: t.text,
                        border: `1px ${c.status === 'pending' ? 'dashed' : 'solid'} ${t.border}`,
                        boxShadow: mine ? `inset 3px 0 0 ${t.border}` : undefined,
                        opacity: c.status === 'cancelled' ? 0.4 : 1,
                        textDecoration: c.status === 'cancelled' ? 'line-through' : 'none',
                      }}
                    >
                      <span className="block truncate text-[12px] font-semibold">
                        {mine ? 'You' : c.userName}
                      </span>
                      {tall && (
                        <span className="block truncate text-[10px] tabular-nums opacity-75">
                          {displayTime(c.at.startMin, use12h)}–{displayTime(c.at.endMin, use12h)}
                        </span>
                      )}
                      {tall && c.status === 'pending' && (
                        <span className="block truncate text-[10px] font-medium opacity-90">
                          awaiting approval
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-gray-100 bg-gray-50/60 text-[11px] text-gray-500">
        <span>Drag down a column to pick a range.</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm border border-dashed border-gray-400" />
            pending
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ background: '#C42B2B' }} />
            now
          </span>
          <span className="tabular-nums">{timezone}</span>
        </span>
      </div>
    </div>
  );
}
