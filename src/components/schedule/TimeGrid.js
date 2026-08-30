'use client';

/**
 * One grid, three views. No calendar library is installed and none should be
 * added — this is ~200 lines of grid maths and it is used by day, week and
 * month alike.
 *
 * Everything is rendered in `timezone` (the block's, unless the viewer has
 * overridden the display zone). Claims arrive as UTC instants and are placed
 * by their wall-clock position in that zone, so a claim never drifts an hour
 * across a DST boundary the way the repo's older calendars do.
 */

import { useMemo, useRef, useState } from 'react';
import { zonedParts, parseHHMM } from '../../lib/scheduleBlocks';

const ROW_H = 26;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad2 = (n) => String(n).padStart(2, '0');
export const hhmm = (mins) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;

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

/** Stable, readable colour per holder so "who has it" reads at a glance. */
const HOLDER_HUES = [212, 152, 28, 340, 264, 190, 88, 8];
export function holderTint(userId) {
  let h = 0;
  for (const ch of String(userId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = HOLDER_HUES[h % HOLDER_HUES.length];
  return { bg: `hsl(${hue} 72% 94%)`, border: `hsl(${hue} 62% 62%)`, text: `hsl(${hue} 62% 28%)` };
}

export default function TimeGrid({
  view = 'week',
  anchorDate,
  timezone = 'UTC',
  window: win,
  claims = [],
  currentUserId,
  onSelectRange,
  onClaimClick,
}) {
  const [drag, setDrag] = useState(null);       // { col, a, b } while selecting
  const dragging = useRef(false);

  const winStart = parseHHMM(win?.startTime || '09:00') ?? 540;
  const winEnd = parseHHMM(win?.endTime || '19:00') ?? 1140;
  const gran = win?.granularityMinutes || 30;
  const rows = Math.max(1, Math.floor((winEnd - winStart) / gran));
  const openDays = win?.days || [0, 1, 2, 3, 4, 5, 6];

  const dates = useMemo(() => {
    if (view === 'day') return [anchorDate];
    if (view === 'month') return monthGrid(anchorDate);
    return weekOf(anchorDate);
  }, [view, anchorDate]);

  const placed = useMemo(
    () => claims.map((c) => ({ ...c, at: placeClaim(c, timezone) })),
    [claims, timezone],
  );
  const byDate = useMemo(() => {
    const m = {};
    for (const c of placed) (m[c.at.dateStr] ||= []).push(c);
    return m;
  }, [placed]);

  /* ── month: density only ─────────────────────────────────────────────── */
  if (view === 'month') {
    const month = anchorDate.slice(0, 7);
    return (
      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-xl overflow-hidden">
        {DOW.map((d) => (
          <div key={d} className="bg-gray-50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{d}</div>
        ))}
        {dates.map((date) => {
          const items = byDate[date] || [];
          const outside = !date.startsWith(month);
          const closed = !openDays.includes(weekdayOf(date));
          return (
            <button
              type="button"
              key={date}
              onClick={() => !closed && onSelectRange?.({ date, startTime: hhmm(winStart), endTime: hhmm(Math.min(winEnd, winStart + gran)), jumpToDay: true })}
              className={`min-h-[86px] p-1.5 text-left align-top ${outside ? 'bg-gray-50' : 'bg-white'} ${closed ? 'opacity-50' : 'hover:bg-blue-50'}`}
            >
              <div className={`text-[11px] font-semibold mb-1 ${outside ? 'text-gray-300' : 'text-gray-600'}`}>{Number(date.slice(8))}</div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((c) => {
                  const t = holderTint(c.userId);
                  return (
                    <div key={c._id} className="truncate rounded px-1 py-0.5 text-[10px] font-medium border"
                      style={{ background: t.bg, borderColor: t.border, color: t.text, opacity: c.status === 'pending' ? 0.65 : 1 }}>
                      {hhmm(c.at.startMin)} {c.userName}
                    </div>
                  );
                })}
                {items.length > 3 && <div className="text-[10px] text-gray-400 px-1">+{items.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  /* ── day / week: a time axis with absolutely-positioned claim bars ────── */
  const commit = () => {
    if (!drag) return;
    const a = Math.min(drag.a, drag.b);
    const b = Math.max(drag.a, drag.b);
    const date = dates[drag.col];
    setDrag(null);
    dragging.current = false;
    onSelectRange?.({
      date,
      startTime: hhmm(winStart + a * gran),
      endTime: hhmm(winStart + (b + 1) * gran),
    });
  };

  return (
    <div className="overflow-x-auto" onMouseLeave={() => { dragging.current = false; setDrag(null); }} onMouseUp={commit}>
      <div
        className="min-w-[560px] bg-white border border-gray-200 rounded-xl overflow-hidden select-none"
        style={{ display: 'grid', gridTemplateColumns: `58px repeat(${dates.length}, minmax(96px, 1fr))` }}
      >
        <div className="bg-gray-50 border-b border-r border-gray-200" />
        {dates.map((date) => (
          <div key={date} className="bg-gray-50 border-b border-gray-200 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {DOW[weekdayOf(date)]} {Number(date.slice(8))}
            {!openDays.includes(weekdayOf(date)) && <span className="ml-1 normal-case font-normal text-gray-400">closed</span>}
          </div>
        ))}

        {/* time axis */}
        <div className="border-r border-gray-100" style={{ height: rows * ROW_H, position: 'relative' }}>
          {Array.from({ length: rows }, (_, r) => (
            (winStart + r * gran) % 60 === 0 ? (
              <div key={r} className="absolute right-1.5 text-[10px] text-gray-400 -translate-y-1/2"
                style={{ top: r * ROW_H }}>{hhmm(winStart + r * gran)}</div>
            ) : null
          ))}
        </div>

        {dates.map((date, col) => {
          const closed = !openDays.includes(weekdayOf(date));
          const items = byDate[date] || [];
          return (
            <div key={date} className={`relative border-l border-gray-100 ${closed ? 'bg-gray-50' : ''}`} style={{ height: rows * ROW_H }}>
              {Array.from({ length: rows }, (_, r) => {
                const selected = drag && drag.col === col && r >= Math.min(drag.a, drag.b) && r <= Math.max(drag.a, drag.b);
                return (
                  <div
                    key={r}
                    onMouseDown={() => { if (closed) return; dragging.current = true; setDrag({ col, a: r, b: r }); }}
                    onMouseEnter={() => { if (dragging.current && drag?.col === col) setDrag((d) => ({ ...d, b: r })); }}
                    className={`absolute left-0 right-0 border-b ${(winStart + (r + 1) * gran) % 60 === 0 ? 'border-gray-200' : 'border-gray-100'} ${closed ? 'cursor-not-allowed' : 'cursor-cell hover:bg-blue-50/60'} ${selected ? 'bg-blue-200/70' : ''}`}
                    style={{ top: r * ROW_H, height: ROW_H }}
                  />
                );
              })}

              {items.map((c) => {
                const top = ((c.at.startMin - winStart) / gran) * ROW_H;
                const h = Math.max(ROW_H - 2, ((c.at.endMin - c.at.startMin) / gran) * ROW_H - 2);
                const t = holderTint(c.userId);
                const mine = String(c.userId) === String(currentUserId);
                return (
                  <button
                    type="button"
                    key={c._id}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onClaimClick?.(c)}
                    title={`${c.userName} · ${hhmm(c.at.startMin)}–${hhmm(c.at.endMin)}${c.status === 'pending' ? ' (pending)' : ''}`}
                    className="absolute left-1 right-1 rounded-md px-1.5 py-0.5 text-left overflow-hidden text-[11px] leading-tight shadow-sm"
                    style={{
                      top: Math.max(0, top) + 1,
                      height: h,
                      background: t.bg,
                      color: t.text,
                      border: `1px ${c.status === 'pending' ? 'dashed' : 'solid'} ${t.border}`,
                      outline: mine ? `2px solid ${t.border}` : 'none',
                      outlineOffset: '-2px',
                      opacity: c.status === 'cancelled' ? 0.4 : 1,
                    }}
                  >
                    <span className="font-semibold block truncate">{mine ? 'You' : c.userName}</span>
                    <span className="block truncate opacity-80">{hhmm(c.at.startMin)}–{hhmm(c.at.endMin)}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">Drag down a column to pick a range. Times are shown in {timezone}.</p>
    </div>
  );
}
