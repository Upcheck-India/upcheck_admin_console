'use client';

/**
 * The Blocks tab of /scheduling. Owners open a block with rules; teammates
 * claim non-overlapping ranges inside it from the shared grid.
 *
 * Follows the page shell already used by the other three tabs: toolbar, card
 * list, modal form. The grid itself is <TimeGrid>.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
// ponytail: namespace import so an icon can be picked by name at runtime.
// Costs bundle size; swap for a hand-built map if it ever shows up in a budget.
import * as Icons from 'lucide-react';
import {
  Plus, Loader2, X, ChevronLeft, ChevronRight, Trash2, Edit2, Copy,
  AlertTriangle, Check, Users, Clock, ArrowLeft, CalendarClock,
} from 'lucide-react';
import TimeGrid, {
  shiftDay, weekOf, holderTint,
  displayHHMM, readTimeFormatPref, writeTimeFormatPref,
} from './TimeGrid';
import { describeRules } from '../../lib/scheduleBlocks';

const ICON_CHOICES = [
  'Terminal', 'Laptop', 'Cpu', 'Bot', 'Camera', 'Video', 'Mic', 'Car',
  'DoorOpen', 'Presentation', 'Wrench', 'Beaker', 'Server', 'Headphones',
  'Printer', 'Package', 'BookOpen', 'Gamepad2', 'CalendarClock', 'Sparkles',
];
const COLOR_CHOICES = ['#0B6DC7', '#00A9C6', '#1E8E48', '#B36A00', '#C42B2B', '#7C3AED', '#DB2777', '#475569'];
const TIMEZONES = ['Asia/Kolkata', 'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Singapore', 'Asia/Dubai', 'Australia/Sydney'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Most blocks want one of a handful of windows. Typing 09:00 and 18:00 into
// two time fields is not hard, but it is friction on the common case, and the
// presets double as a hint about what this field is for.
// 'All hours' ends at 24:00 — midnight at the end of the day. 23:59 used to
// be the only expressible end, and because it lands on no slot boundary the
// last hour of the day was silently unbookable.
const WINDOW_PRESETS = [
  { label: 'Full day', start: '09:00', end: '18:00' },
  { label: 'First half', start: '09:00', end: '13:30' },
  { label: 'Second half', start: '13:30', end: '18:00' },
  { label: 'Morning', start: '09:00', end: '12:00' },
  { label: 'Afternoon', start: '12:00', end: '17:00' },
  { label: 'Evening', start: '17:00', end: '21:00' },
  { label: 'All hours', start: '00:00', end: '24:00' },
];

function BlockIcon({ name, className }) {
  const C = Icons[name] || CalendarClock;
  return <C className={className} />;
}

const todayIn = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()); // en-CA gives YYYY-MM-DD

const emptyBlock = () => ({
  title: '', description: '', icon: 'Terminal', color: '#0B6DC7',
  timezone: 'Asia/Kolkata',
  startDate: todayIn('Asia/Kolkata'), endDate: '',
  window: { days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '19:00', granularityMinutes: 30 },
  rules: {
    minMinutes: 30, maxMinutes: 300, maxMinutesPerDay: 300, maxMinutesPerWeek: 600,
    maxClaimsPerDay: '', capacity: 1, advanceNoticeMinutes: 0, horizonDays: '',
  },
  claimMode: 'instant',
  cancellableUntilMinutesBefore: 60,
  access: { visibility: 'org', allowRoles: [], allowTeams: [], allowUserIds: [], denyUserIds: [] },
  status: 'open',
});

export default function BlocksTab() {
  const [openBlockId, setOpenBlockId] = useState(null);
  return openBlockId
    ? <BlockDetail id={openBlockId} onBack={() => setOpenBlockId(null)} />
    : <BlockList onOpen={setOpenBlockId} />;
}

/* ─────────────────────────────  The list  ────────────────────────────── */

function BlockList({ onOpen }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editorFor, setEditorFor] = useState(null);   // block object, or 'new'
  const [search, setSearch] = useState('');
  const [mine, setMine] = useState(false);
  const [userId, setUserId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scheduling/blocks', { credentials: 'include' });
      const data = await res.json();
      setBlocks(data.blocks || []);
      setUserId(data.userId || '');
    } catch {
      toast.error('Could not load blocks');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => blocks.filter((b) => {
    const q = search.toLowerCase().trim();
    if (q && !`${b.title} ${b.description || ''}`.toLowerCase().includes(q)) return false;
    if (mine && String(b.ownerId) !== String(userId)) return false;
    return true;
  }), [blocks, search, mine, userId]);

  const close = async (b) => {
    if (!window.confirm(`Close "${b.title}"? Existing claims are kept.`)) return;
    const res = await fetch(`/api/scheduling/blocks/${b._id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { toast.success('Block closed'); load(); } else toast.error('Could not close it');
  };

  const duplicate = async (b) => {
    const res = await fetch(`/api/scheduling/blocks/${b._id}/duplicate`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shiftDays: 7 }),
    });
    if (res.ok) { toast.success('Duplicated, dates shifted a week on'); load(); } else toast.error('Could not duplicate it');
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-blue-500" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h3 className="font-bold text-gray-800 text-sm">Claimable Blocks ({shown.length})</h3>
        <button onClick={() => setEditorFor('new')} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-bold shadow-sm">
          <Plus className="h-4 w-4" /> New Block
        </button>
      </div>

      {blocks.length > 0 && (
        <div className="flex flex-col md:flex-row justify-between gap-3 mb-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks by title or description..."
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <label className="flex items-center gap-2 text-xs text-gray-600 shrink-0">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="rounded" />
            Only blocks I own
          </label>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CalendarClock className="h-14 w-14 text-blue-200 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No blocks yet</h3>
          <p className="text-gray-500 text-sm">Open one and let the team claim time inside it.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shown.map((b) => (
            <div key={b._id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col hover:shadow-md transition-all">
              <button onClick={() => onOpen(b._id)} className="text-left">
                <div className="flex items-start gap-3">
                  <span className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${b.color}1A`, color: b.color }}>
                    <BlockIcon name={b.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 truncate">{b.title}</h3>
                    <p className="text-xs text-gray-500 truncate">
                      {b.startDate}{b.endDate ? ` – ${b.endDate}` : ' onwards'} · {b.window.startTime}–{b.window.endTime} · {b.timezone}
                    </p>
                  </div>
                  {b.status !== 'open' && (
                    <span className="text-[10px] uppercase font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border">{b.status}</span>
                  )}
                </div>
                {b.description && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{b.description}</p>}
                <p className="mt-2 text-xs text-gray-500">{describeRules(b)}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {b.counts?.confirmed || 0} claims</span>
                  {b.claimMode === 'approval' && (
                    <span className="flex items-center gap-1 text-amber-600"><Clock className="h-3 w-3" /> {b.counts?.pending || 0} pending</span>
                  )}
                </div>
              </button>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1">
                <button onClick={() => onOpen(b._id)} className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50">Open calendar</button>
                <div className="flex-1" />
                <button title="Duplicate" onClick={() => duplicate(b)} className="p-1.5 text-gray-400 hover:text-blue-600"><Copy className="h-4 w-4" /></button>
                <button title="Edit" onClick={() => setEditorFor(b)} className="p-1.5 text-gray-400 hover:text-blue-600"><Edit2 className="h-4 w-4" /></button>
                <button title="Close" onClick={() => close(b)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editorFor && (
        <BlockEditor
          block={editorFor === 'new' ? null : editorFor}
          onClose={() => setEditorFor(null)}
          onSaved={() => { setEditorFor(null); load(); }}
        />
      )}
    </div>
  );
}

/* ───────────────────────────  The editor  ────────────────────────────── */

/* ────────────────────────  Creating and editing a block  ───────────────── */

/**
 * Four steps rather than one long form.
 *
 * A block has twenty-odd settings and only four of them are needed to make a
 * useful one. Showing all twenty at once made the common case look like the
 * hard case. Splitting them means each screen asks one question — what is it,
 * when is it open, how much may one person take, who may take it — and the
 * defaults carry the rest.
 *
 * Editing skips the gate: every step is reachable immediately, because someone
 * editing already knows what they came to change and should not have to walk
 * past three screens to reach it.
 */

const STEPS = [
  { id: 'identity', label: 'Identity', hint: 'Name it and give it a face' },
  { id: 'schedule', label: 'Schedule', hint: 'When the block is open' },
  { id: 'rules', label: 'Rules', hint: 'How much one person may take' },
  { id: 'access', label: 'Access', hint: 'Who may claim, and how' },
];

// Shared control styles, defined once so the four steps cannot drift apart.
const UI = {
  label: 'block text-xs font-medium text-gray-600 mb-1',
  input:
    'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm ' +
    'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none',
  chip: 'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
  chipOn: 'bg-blue-600 text-white border-blue-600',
  chipOff: 'text-gray-600 border-gray-300 hover:border-gray-400 bg-white',
};

function Field({ label, hint, children }) {
  return (
    <div>
      <label className={UI.label}>
        {label}
        {hint && <span className="text-gray-400 font-normal"> {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Choice({ active, onClick, title, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-3 py-2 rounded-lg border transition-colors ${
        active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <span className="block text-sm font-medium text-gray-800">{title}</span>
      {hint && <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>}
    </button>
  );
}

/** The step rail. Doubles as navigation once a step has been reached. */
function StepRail({ step, furthest, onJump }) {
  return (
    <ol className="flex items-center gap-1 px-4 pb-3">
      {STEPS.map((s, i) => {
        const state = i === step ? 'current' : i < furthest || i < step ? 'done' : 'todo';
        return (
          <li key={s.id} className="flex items-center gap-1 flex-1 min-w-0">
            <button
              type="button"
              disabled={i > furthest}
              onClick={() => onJump(i)}
              title={s.hint}
              className={`flex items-center gap-1.5 min-w-0 rounded-lg px-1.5 py-1 transition-colors ${
                i > furthest ? 'cursor-default' : 'hover:bg-gray-100'
              }`}
            >
              <span
                className={`h-5 w-5 shrink-0 rounded-full grid place-items-center text-[10px] font-bold ${
                  state === 'current'
                    ? 'bg-blue-600 text-white'
                    : state === 'done'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {state === 'done' ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className={`text-xs truncate ${
                  state === 'current' ? 'font-semibold text-gray-900' : 'text-gray-500'
                }`}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span
                className={`h-px flex-1 ${i < furthest ? 'bg-blue-200' : 'bg-gray-200'}`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function BlockEditor({ block, onClose, onSaved }) {
  const [form, setForm] = useState(() => (block ? {
    ...emptyBlock(), ...block,
    endDate: block.endDate || '',
    rules: { ...emptyBlock().rules, ...block.rules, maxClaimsPerDay: block.rules?.maxClaimsPerDay ?? '', horizonDays: block.rules?.horizonDays ?? '' },
    access: { ...emptyBlock().access, ...block.access },
  } : emptyBlock()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [audience, setAudience] = useState({ roles: [], teams: [], users: [] });
  const [iconQuery, setIconQuery] = useState('');
  const [step, setStep] = useState(0);
  // Editing unlocks every step at once; creating unlocks them as you go, so
  // the numbers mean progress rather than decoration.
  const [furthest, setFurthest] = useState(block ? STEPS.length - 1 : 0);

  useEffect(() => {
    fetch('/api/scheduling/blocks/audience', { credentials: 'include' })
      .then((r) => r.json()).then(setAudience).catch(() => {});
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setWin = (patch) => setForm((f) => ({ ...f, window: { ...f.window, ...patch } }));
  const setRule = (patch) => setForm((f) => ({ ...f, rules: { ...f.rules, ...patch } }));
  const setAccess = (patch) => setForm((f) => ({ ...f, access: { ...f.access, ...patch } }));
  const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  // The plain-English echo, so the owner reads back what six number fields mean.
  const echo = useMemo(() => {
    try {
      return describeRules({
        rules: {
          ...form.rules,
          maxClaimsPerDay: form.rules.maxClaimsPerDay === '' ? null : Number(form.rules.maxClaimsPerDay),
          maxMinutesPerDay: form.rules.maxMinutesPerDay === '' || form.rules.maxMinutesPerDay === null ? null : Number(form.rules.maxMinutesPerDay),
          maxMinutesPerWeek: form.rules.maxMinutesPerWeek === '' || form.rules.maxMinutesPerWeek === null ? null : Number(form.rules.maxMinutesPerWeek),
        },
      });
    } catch { return ''; }
  }, [form.rules]);

  /**
   * What is wrong with the current step, or null.
   *
   * Checked per step rather than only on submit: being told on screen four
   * that screen two was wrong is the thing that makes wizards worse than long
   * forms, not better.
   */
  const stepError = useMemo(() => {
    if (step === 0) {
      if (!form.title.trim()) return 'Give the block a name.';
    }
    if (step === 1) {
      if (!form.startDate) return 'Pick a start date.';
      if (form.endDate && form.endDate < form.startDate) return 'The end date is before the start date.';
      if (!form.window.days.length) return 'Choose at least one weekday.';
      if (form.window.startTime >= form.window.endTime) return 'The open-until time must be after open-from.';
      if (Number(form.window.granularityMinutes) < 15) return 'Slot size must be at least 15 minutes.';
    }
    if (step === 2) {
      const { minMinutes, maxMinutes, capacity } = form.rules;
      if (Number(minMinutes) < 1) return 'Minimum length must be at least a minute.';
      if (Number(maxMinutes) < Number(minMinutes)) return 'Maximum length is below the minimum.';
      if (Number(capacity) < 1) return 'Capacity must be at least one.';
    }
    if (step === 3) {
      const { visibility, allowRoles, allowTeams, allowUserIds } = form.access;
      if (visibility === 'restricted' && !allowRoles.length && !allowTeams.length && !allowUserIds.length) {
        return 'A restricted block needs at least one role, team or person.';
      }
    }
    return null;
  }, [step, form]);

  const go = (next) => {
    if (next > step && stepError) { setError(stepError); return; }
    setError('');
    setStep(next);
    setFurthest((f) => Math.max(f, next));
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    // Enter inside a field fires the form's submit. On any step but the last
    // that means 'go on', not 'save' — a half-filled block should never be
    // created because someone pressed Enter in the title field.
    if (!last) { go(step + 1); return; }
    if (stepError) { setError(stepError); return; }
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        endDate: form.endDate || null,
        cancellableUntilMinutesBefore: form.cancellableUntilMinutesBefore === '' ? null : Number(form.cancellableUntilMinutesBefore),
        rules: Object.fromEntries(Object.entries(form.rules).map(([k, v]) => [k, v === '' ? null : v])),
      };
      const url = block ? `/api/scheduling/blocks/${block._id}` : '/api/scheduling/blocks';
      const res = await fetch(url, {
        method: block ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not save'); return; }
      toast.success(block ? 'Block updated' : 'Block created');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const endsAtMidnight = form.window.endTime === '24:00';
  const icons = ICON_CHOICES.filter((n) => n.toLowerCase().includes(iconQuery.toLowerCase()));
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[88vh]">

        {/* Header doubles as a live preview: the icon and colour chosen on step
            one stay visible while the rest is filled in. */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <span
            className="h-9 w-9 rounded-xl grid place-items-center shrink-0 transition-colors"
            style={{ background: `${form.color}1A`, color: form.color }}
          >
            <BlockIcon name={form.icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              {form.title.trim() || (block ? 'Edit block' : 'New block')}
            </h2>
            <p className="text-xs text-gray-500">{STEPS[step].hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <StepRail step={step} furthest={furthest} onJump={go} />

        <form onSubmit={submit} className="flex flex-col min-h-0 flex-1">
          <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-[19rem]">

            {/* ── 1 · Identity ─────────────────────────────────────────── */}
            {step === 0 && (
              <div className="space-y-3">
                <Field label="Name">
                  <input
                    autoFocus
                    value={form.title}
                    onChange={(e) => set({ title: e.target.value })}
                    placeholder="e.g. Claude Code seat"
                    className={UI.input}
                  />
                </Field>

                <Field label="What is it for?" hint="(optional)">
                  <textarea
                    value={form.description}
                    onChange={(e) => set({ description: e.target.value })}
                    rows={2}
                    placeholder="One line your team will read before claiming."
                    className={UI.input}
                  />
                </Field>

                <Field label="Colour">
                  <div className="flex gap-1.5 flex-wrap">
                    {COLOR_CHOICES.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => set({ color: c })}
                        aria-label={`Colour ${c}`}
                        className={`h-7 w-7 rounded-full transition-transform ${
                          form.color === c ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : ''
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </Field>

                <Field label="Icon">
                  <input
                    value={iconQuery}
                    onChange={(e) => setIconQuery(e.target.value)}
                    placeholder="Search…"
                    className={`${UI.input} mb-2`}
                  />
                  <div className="grid grid-cols-10 gap-1 max-h-[7.5rem] overflow-y-auto pr-1">
                    {icons.map((n) => (
                      <button
                        type="button"
                        key={n}
                        title={n}
                        onClick={() => set({ icon: n })}
                        className={`h-8 rounded-lg grid place-items-center transition-colors ${
                          form.icon === n
                            ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <BlockIcon name={n} className="h-4 w-4" />
                      </button>
                    ))}
                    {icons.length === 0 && (
                      <p className="col-span-10 text-xs text-gray-400 py-3 text-center">
                        No icon matches “{iconQuery}”.
                      </p>
                    )}
                  </div>
                </Field>
              </div>
            )}

            {/* ── 2 · Schedule ─────────────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-3">
                <Field label="Timezone" hint="— sets what “a day” means for the quotas">
                  <select value={form.timezone} onChange={(e) => set({ timezone: e.target.value })} className={UI.input}>
                    {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Starts">
                    <input type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} className={UI.input} />
                  </Field>
                  <Field label="Ends" hint="(blank = rolling)">
                    <input type="date" value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} className={UI.input} />
                  </Field>
                </div>

                <Field label="Open on">
                  <div className="flex gap-1.5 flex-wrap">
                    {DOW.map((d, i) => (
                      <button
                        type="button"
                        key={d}
                        onClick={() => setWin({ days: toggle(form.window.days, i) })}
                        className={`${UI.chip} ${form.window.days.includes(i) ? UI.chipOn : UI.chipOff}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Open hours">
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {WINDOW_PRESETS.map((p) => {
                      const active =
                        form.window.startTime === p.start && form.window.endTime === p.end;
                      return (
                        <button
                          type="button"
                          key={p.label}
                          onClick={() => setWin({ startTime: p.start, endTime: p.end })}
                          title={`${p.start} – ${p.end}`}
                          className={`${UI.chip} ${active ? UI.chipOn : UI.chipOff}`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <span className="block text-[11px] text-gray-400 mb-1">From</span>
                      <input type="time" value={form.window.startTime} onChange={(e) => setWin({ startTime: e.target.value })} className={UI.input} />
                    </div>
                    <div>
                      <span className="block text-[11px] text-gray-400 mb-1">Until</span>
                      {/* A native time input cannot express 24:00 — its range
                          stops at 23:59 — so end-of-day gets its own control
                          below and this field is stood down while it is on. */}
                      <input
                        type="time"
                        value={endsAtMidnight ? '' : form.window.endTime}
                        disabled={endsAtMidnight}
                        placeholder="24:00"
                        onChange={(e) => setWin({ endTime: e.target.value })}
                        className={`${UI.input} disabled:bg-gray-100 disabled:text-gray-400`}
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-gray-400 mb-1">Slot size (min)</span>
                      <input type="number" min="15" step="5" value={form.window.granularityMinutes} onChange={(e) => setWin({ granularityMinutes: Number(e.target.value) })} className={UI.input} />
                    </div>
                  </div>

                  <label className="flex items-start gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={endsAtMidnight}
                      onChange={(e) =>
                        setWin({ endTime: e.target.checked ? '24:00' : '18:00' })
                      }
                      className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-600">
                      Runs until midnight
                      <span className="block text-[11px] text-gray-400">
                        Ends at 24:00 rather than 23:59, so the last slot of the day is a
                        whole slot and can actually be claimed.
                      </span>
                    </span>
                  </label>
                </Field>

                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  Claims snap to {form.window.granularityMinutes}-minute boundaries counted from{' '}
                  {form.window.startTime}, in {form.timezone}.
                </p>
              </div>
            )}

            {/* ── 3 · Rules ────────────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Shortest claim" hint="min">
                    <input type="number" min="1" value={form.rules.minMinutes} onChange={(e) => setRule({ minMinutes: Number(e.target.value) })} className={UI.input} />
                  </Field>
                  <Field label="Longest claim" hint="min">
                    <input type="number" min="1" value={form.rules.maxMinutes} onChange={(e) => setRule({ maxMinutes: Number(e.target.value) })} className={UI.input} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Per person, per day" hint="min">
                    <input type="number" min="0" value={form.rules.maxMinutesPerDay ?? ''} onChange={(e) => setRule({ maxMinutesPerDay: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="no cap" className={UI.input} />
                  </Field>
                  <Field label="Per person, per week" hint="min">
                    <input type="number" min="0" value={form.rules.maxMinutesPerWeek ?? ''} onChange={(e) => setRule({ maxMinutesPerWeek: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="no cap" className={UI.input} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Claims per day" hint="each">
                    <input type="number" min="0" value={form.rules.maxClaimsPerDay ?? ''} onChange={(e) => setRule({ maxClaimsPerDay: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="no cap" className={UI.input} />
                  </Field>
                  <Field label="Capacity" hint="— how many at once">
                    <input type="number" min="1" value={form.rules.capacity} onChange={(e) => setRule({ capacity: Number(e.target.value) })} className={UI.input} />
                  </Field>
                </div>

                <details className="group">
                  <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none list-none flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    Timing limits
                  </summary>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Field label="Minimum notice" hint="min">
                      <input type="number" min="0" value={form.rules.advanceNoticeMinutes} onChange={(e) => setRule({ advanceNoticeMinutes: Number(e.target.value) })} className={UI.input} />
                    </Field>
                    <Field label="Bookable ahead" hint="days">
                      <input type="number" min="0" value={form.rules.horizonDays ?? ''} onChange={(e) => setRule({ horizonDays: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="no limit" className={UI.input} />
                    </Field>
                  </div>
                </details>

                {echo && (
                  <p className="text-xs text-blue-900 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    {echo}
                  </p>
                )}
              </div>
            )}

            {/* ── 4 · Access and approval ──────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-3">
                <Field label="Who can claim">
                  <div className="grid grid-cols-2 gap-2">
                    <Choice
                      active={form.access.visibility === 'org'}
                      onClick={() => setAccess({ visibility: 'org' })}
                      title="Everyone"
                      hint="Anyone signed in"
                    />
                    <Choice
                      active={form.access.visibility === 'restricted'}
                      onClick={() => setAccess({ visibility: 'restricted' })}
                      title="Only who I pick"
                      hint="Roles, teams or people"
                    />
                  </div>
                </Field>

                {form.access.visibility === 'restricted' && (
                  <div className="space-y-3 pl-3 border-l-2 border-blue-100">
                    {audience.roles.length > 0 && (
                      <Field label="Roles">
                        <div className="flex gap-1.5 flex-wrap">
                          {audience.roles.map((r) => (
                            <button type="button" key={r} onClick={() => setAccess({ allowRoles: toggle(form.access.allowRoles, r) })}
                              className={`${UI.chip} ${form.access.allowRoles.includes(r) ? UI.chipOn : UI.chipOff}`}>{r}</button>
                          ))}
                        </div>
                      </Field>
                    )}
                    {audience.teams.length > 0 && (
                      <Field label="Teams">
                        <div className="flex gap-1.5 flex-wrap max-h-20 overflow-y-auto">
                          {audience.teams.map((t) => (
                            <button type="button" key={t._id} onClick={() => setAccess({ allowTeams: toggle(form.access.allowTeams, t._id) })}
                              className={`${UI.chip} ${form.access.allowTeams.includes(t._id) ? UI.chipOn : UI.chipOff}`}>{t.name}</button>
                          ))}
                        </div>
                      </Field>
                    )}
                    <Field label="People" hint="— ctrl-click for several">
                      <select multiple value={form.access.allowUserIds} size={4}
                        onChange={(e) => setAccess({ allowUserIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
                        className={UI.input}>
                        {audience.users.map((u) => <option key={u._id} value={u._id}>{u.name} · {u.role}</option>)}
                      </select>
                    </Field>
                  </div>
                )}

                <Field label="Approval">
                  <div className="grid grid-cols-2 gap-2">
                    <Choice
                      active={form.claimMode === 'instant'}
                      onClick={() => set({ claimMode: 'instant' })}
                      title="First come, first served"
                      hint="Claims land immediately"
                    />
                    <Choice
                      active={form.claimMode === 'approval'}
                      onClick={() => set({ claimMode: 'approval' })}
                      title="I approve each one"
                      hint="Requests queue for you"
                    />
                  </div>
                </Field>

                <details className="group">
                  <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none list-none flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    Cancellation, status and blocked people
                  </summary>
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Cancellable until" hint="min before">
                        <input type="number" min="0" value={form.cancellableUntilMinutesBefore ?? ''} onChange={(e) => set({ cancellableUntilMinutesBefore: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="any time" className={UI.input} />
                      </Field>
                      <Field label="Status">
                        <select value={form.status} onChange={(e) => set({ status: e.target.value })} className={UI.input}>
                          <option value="open">Open</option><option value="paused">Paused</option><option value="closed">Closed</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Never allow" hint="— wins over everything, including admin">
                      <select multiple value={form.access.denyUserIds} size={3}
                        onChange={(e) => setAccess({ denyUserIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
                        className={UI.input}>
                        {audience.users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                      </select>
                    </Field>
                  </div>
                </details>
              </div>
            )}
          </div>

          {/* Errors sit next to the buttons, where the eye already is when a
              step refuses to advance. */}
          {error && (
            <div className="mx-4 mb-2 bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg flex gap-2 items-start">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t bg-gray-50 rounded-b-2xl">
            <button
              type="button"
              onClick={step === 0 ? onClose : () => go(step - 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
            >
              {step > 0 && <ChevronLeft className="h-4 w-4" />}
              {step === 0 ? 'Cancel' : 'Back'}
            </button>

            <span className="text-xs text-gray-400 tabular-nums">
              {step + 1} / {STEPS.length}
            </span>

            {/* Both branches are type="button", and they carry different keys.
                A single button whose type flipped from "button" to "submit"
                during the re-render its own click triggered was submitting the
                form: React reused the DOM node, the browser saw a submit
                button under the pointer, and ran the default action. Clicking
                Next on step three created the block. */}
            {last ? (
              <button
                key="save"
                type="button"
                onClick={submit}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {block ? 'Save changes' : 'Create block'}
              </button>
            ) : (
              <button
                key="next"
                type="button"
                onClick={() => go(step + 1)}
                className="inline-flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ──────────────────────  The calendar for one block  ─────────────────── */

function BlockDetail({ id, onBack }) {
  const [state, setState] = useState({ loading: true, block: null, claims: [], canManage: false, userId: '', quota: null });
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(null);
  const [displayTz, setDisplayTz] = useState(null);
  // Display only. Everything on the wire stays 24-hour 'HH:MM'.
  const [timeFormat, setTimeFormat] = useState('24h');
  useEffect(() => { setTimeFormat(readTimeFormatPref()); }, []);
  const use12h = timeFormat === '12h';
  const setFormat = (v) => { setTimeFormat(v); writeTimeFormatPref(v); };
  const [pending, setPending] = useState(null);      // the drag-selected range

  const load = useCallback(async (anchorDate) => {
    const meta = await fetch(`/api/scheduling/blocks/${id}`, { credentials: 'include' }).then((r) => r.json());
    if (meta.error) { toast.error(meta.error); onBack(); return; }
    const day = anchorDate || todayIn(meta.block.timezone);
    const from = shiftDay(day, -40);
    const to = shiftDay(day, 40);
    const feed = await fetch(
      `/api/scheduling/blocks/${id}/claims?from=${from}T00:00:00.000Z&to=${to}T00:00:00.000Z`,
      { credentials: 'include' },
    ).then((r) => r.json());
    setState({
      loading: false, block: meta.block, quota: meta.quota, canManage: meta.canManage,
      claims: feed.claims || [], userId: feed.userId || '',
    });
    setAnchor((a) => a || day);
    setDisplayTz((t) => t || meta.block.timezone);
  }, [id, onBack]);

  // The feed spans +/-40 days around the anchor, so refetch when the viewer
  // navigates past that or their own claims would quietly vanish off the grid.
  useEffect(() => { load(anchor); }, [load, anchor]);

  const { block, claims, canManage, userId, quota } = state;
  if (state.loading || !block || !anchor) {
    return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-blue-500" /></div>;
  }

  const step = view === 'day' ? 1 : view === 'week' ? 7 : 30;
  const pendingClaims = claims.filter((c) => c.status === 'pending');

  const decide = async (claim, action, reason) => {
    const res = await fetch(`/api/scheduling/claims/${claim._id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(data.error || 'Could not do that'); load(anchor); return; }
    toast.success(action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Cancelled');
    load(anchor);
  };

  const rangeLabel = view === 'day' ? anchor
    : view === 'week' ? `${weekOf(anchor)[0]} → ${weekOf(anchor)[6]}`
      : anchor.slice(0, 7);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Blocks
        </button>
        <span className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: `${block.color}1A`, color: block.color }}>
          <BlockIcon name={block.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{block.title}</h3>
          <p className="text-xs text-gray-500">{describeRules(block)}</p>
        </div>
      </div>

      {quota && (
        <div className="mb-4 text-xs text-gray-600 bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap gap-4">
          <span>Your allowance today: <strong>{quota.dayRemaining == null ? 'unlimited' : `${quota.dayRemaining} min`}</strong></span>
          <span>This week: <strong>{quota.weekRemaining == null ? 'unlimited' : `${quota.weekRemaining} min`}</strong></span>
          <span className="text-gray-400">quotas counted in {block.timezone}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3 bg-white p-2 rounded-xl border border-gray-200">
        <button onClick={() => setAnchor(shiftDay(anchor, -step))} className="p-1.5 text-gray-500 hover:text-gray-800"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-xs font-semibold text-gray-700 min-w-[170px] text-center">{rangeLabel}</span>
        <button onClick={() => setAnchor(shiftDay(anchor, step))} className="p-1.5 text-gray-500 hover:text-gray-800"><ChevronRight className="h-4 w-4" /></button>
        <button onClick={() => setAnchor(todayIn(block.timezone))} className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Today</button>
        <div className="flex-1" />
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {['day', 'week', 'month'].map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 text-xs font-medium capitalize ${view === v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{v}</button>
          ))}
        </div>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden" title="Clock format">
          {['24h', '12h'].map((f) => (
            <button key={f} onClick={() => setFormat(f)}
              className={`px-2.5 py-1 text-xs font-medium ${timeFormat === f ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{f}</button>
          ))}
        </div>
        <select value={displayTz} onChange={(e) => setDisplayTz(e.target.value)} className="px-2 py-1 border border-gray-300 rounded-lg text-xs text-gray-600">
          {[...new Set([block.timezone, ...TIMEZONES])].map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      {canManage && pendingClaims.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">Waiting on you ({pendingClaims.length})</h4>
          <div className="space-y-1.5">
            {pendingClaims.map((c) => (
              <div key={c._id} className="flex items-center gap-2 text-sm bg-white rounded-lg px-3 py-1.5 border border-amber-100">
                <span className="font-medium text-gray-800">{c.userName}</span>
                <span className="text-gray-500 text-xs">
                  {new Date(c.startTime).toLocaleString('en-GB', { timeZone: displayTz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: use12h })} · {c.minutes} min
                </span>
                {c.leaveWarning && <span className="text-[10px] text-amber-700 bg-amber-100 rounded px-1.5">on {c.leaveWarning.leaveTypeName}</span>}
                <div className="flex-1" />
                <button onClick={() => decide(c, 'approve')} className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:bg-green-50 px-2 py-1 rounded"><Check className="h-3.5 w-3.5" /> Approve</button>
                <button onClick={() => decide(c, 'reject')} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded"><X className="h-3.5 w-3.5" /> Reject</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <TimeGrid
        view={view}
        use12h={use12h}
        anchorDate={anchor}
        timezone={displayTz}
        accent={block.color}
        window={block.window}
        claims={claims}
        currentUserId={userId}
        onSelectRange={(sel) => {
          if (sel.jumpToDay) { setAnchor(sel.date); setView('day'); return; }
          setPending(sel);
        }}
        onClaimClick={(c) => {
          if (String(c.userId) !== String(userId) && !canManage) return;
          if (window.confirm(`Cancel ${String(c.userId) === String(userId) ? 'your' : `${c.userName}'s`} claim?`)) decide(c, 'cancel');
        }}
      />

      {pending && (
        <ClaimPanel
          block={block}
          range={pending}
          use12h={use12h}
          onClose={() => setPending(null)}
          onDone={() => { setPending(null); load(anchor); }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────  The claim panel  ─────────────────────────── */

function ClaimPanel({ block, range, use12h, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const minutes = toMin(range.endTime) - toMin(range.startTime);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/scheduling/blocks/${block._id}/claims`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: range.date, startTime: range.startTime, endTime: range.endTime, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not claim that');
        if (res.status === 409) { toast.error('Someone just took that'); onDone(); }
        return;
      }
      toast.success(block.claimMode === 'approval' ? 'Requested' : 'Claimed');
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const tint = holderTint('you');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{block.claimMode === 'approval' ? 'Request this time' : 'Claim this time'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm p-2 rounded flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{error}</div>}
          <div className="rounded-lg border p-3" style={{ background: tint.bg, borderColor: tint.border, color: tint.text }}>
            <div className="font-semibold">{range.date}</div>
            <div className="text-sm">
              {displayHHMM(range.startTime, use12h)} – {displayHHMM(range.endTime, use12h)} · {minutes} min
            </div>
            <div className="text-xs opacity-70 mt-1">{block.timezone}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}{block.claimMode === 'approval' ? 'Request' : 'Claim it'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
