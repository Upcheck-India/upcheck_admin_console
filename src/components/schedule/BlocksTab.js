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
import TimeGrid, { shiftDay, weekOf, holderTint } from './TimeGrid';
import { describeRules } from '../../lib/scheduleBlocks';

const ICON_CHOICES = [
  'Terminal', 'Laptop', 'Cpu', 'Bot', 'Camera', 'Video', 'Mic', 'Car',
  'DoorOpen', 'Presentation', 'Wrench', 'Beaker', 'Server', 'Headphones',
  'Printer', 'Package', 'BookOpen', 'Gamepad2', 'CalendarClock', 'Sparkles',
];
const COLOR_CHOICES = ['#0B6DC7', '#00A9C6', '#1E8E48', '#B36A00', '#C42B2B', '#7C3AED', '#DB2777', '#475569'];
const TIMEZONES = ['Asia/Kolkata', 'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Singapore', 'Asia/Dubai', 'Australia/Sydney'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  const submit = async (e) => {
    e.preventDefault();
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

  const icons = ICON_CHOICES.filter((n) => n.toLowerCase().includes(iconQuery.toLowerCase()));
  const label = 'block text-sm font-medium text-gray-700 mb-1';
  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm';
  const group = 'border border-gray-200 rounded-xl p-4 space-y-3';
  const legend = 'text-xs font-bold uppercase tracking-wide text-gray-500';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-xl">
          <h2 className="text-lg font-semibold">{block ? 'Edit Block' : 'New Block'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={submit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm p-2 rounded flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{error}</div>}

          {/* Identity first — the icon and colour follow the block everywhere. */}
          <div className={group}>
            <span className={legend}>What and when</span>
            <div className="flex gap-3 items-start">
              <span className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${form.color}1A`, color: form.color }}>
                <BlockIcon name={form.icon} className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Claude Code seat" className={input} />
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {COLOR_CHOICES.map((c) => (
                <button type="button" key={c} onClick={() => set({ color: c })}
                  className={`h-6 w-6 rounded-full border-2 ${form.color === c ? 'border-gray-800' : 'border-transparent'}`} style={{ background: c }} />
              ))}
            </div>
            <input value={iconQuery} onChange={(e) => setIconQuery(e.target.value)} placeholder="Search icons…" className={`${input} text-xs`} />
            <div className="grid grid-cols-10 gap-1 max-h-24 overflow-y-auto">
              {icons.map((n) => (
                <button type="button" key={n} title={n} onClick={() => set({ icon: n })}
                  className={`h-8 rounded flex items-center justify-center ${form.icon === n ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                  <BlockIcon name={n} className="h-4 w-4" />
                </button>
              ))}
            </div>
            <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} placeholder="What is this block for?" className={input} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className={label}>Timezone</label>
                <select value={form.timezone} onChange={(e) => set({ timezone: e.target.value })} className={input}>
                  {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={label}>Starts</label>
                <input type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} className={input} />
              </div>
              <div><label className={label}>Ends <span className="text-gray-400 font-normal">(blank = rolling)</span></label>
                <input type="date" value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} className={input} />
              </div>
              <div><label className={label}>Slot size (min)</label>
                <input type="number" min="15" step="5" value={form.window.granularityMinutes} onChange={(e) => setWin({ granularityMinutes: Number(e.target.value) })} className={input} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Open from</label>
                <input type="time" value={form.window.startTime} onChange={(e) => setWin({ startTime: e.target.value })} className={input} />
              </div>
              <div><label className={label}>Open until</label>
                <input type="time" value={form.window.endTime} onChange={(e) => setWin({ endTime: e.target.value })} className={input} />
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {DOW.map((d, i) => (
                <button type="button" key={d} onClick={() => setWin({ days: toggle(form.window.days, i) })}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border ${form.window.days.includes(i) ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 border-gray-300'}`}>{d}</button>
              ))}
            </div>
          </div>

          <div className={group}>
            <span className={legend}>Claim rules</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className={label}>Min length (min)</label><input type="number" min="0" value={form.rules.minMinutes} onChange={(e) => setRule({ minMinutes: Number(e.target.value) })} className={input} /></div>
              <div><label className={label}>Max length (min)</label><input type="number" min="0" value={form.rules.maxMinutes} onChange={(e) => setRule({ maxMinutes: Number(e.target.value) })} className={input} /></div>
              <div><label className={label}>Per person / day</label><input type="number" min="0" value={form.rules.maxMinutesPerDay ?? ''} onChange={(e) => setRule({ maxMinutesPerDay: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="no cap" className={input} /></div>
              <div><label className={label}>Per person / week</label><input type="number" min="0" value={form.rules.maxMinutesPerWeek ?? ''} onChange={(e) => setRule({ maxMinutesPerWeek: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="no cap" className={input} /></div>
              <div><label className={label}>Claims / day</label><input type="number" min="0" value={form.rules.maxClaimsPerDay ?? ''} onChange={(e) => setRule({ maxClaimsPerDay: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="no cap" className={input} /></div>
              <div><label className={label}>Capacity</label><input type="number" min="1" value={form.rules.capacity} onChange={(e) => setRule({ capacity: Number(e.target.value) })} className={input} /></div>
              <div><label className={label}>Notice (min)</label><input type="number" min="0" value={form.rules.advanceNoticeMinutes} onChange={(e) => setRule({ advanceNoticeMinutes: Number(e.target.value) })} className={input} /></div>
              <div><label className={label}>Horizon (days)</label><input type="number" min="0" value={form.rules.horizonDays ?? ''} onChange={(e) => setRule({ horizonDays: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="no limit" className={input} /></div>
            </div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{echo}</p>
          </div>

          <div className={group}>
            <span className={legend}>Who can claim</span>
            <div className="flex gap-4 text-sm">
              {['org', 'restricted'].map((v) => (
                <label key={v} className="flex items-center gap-2">
                  <input type="radio" name="visibility" checked={form.access.visibility === v} onChange={() => setAccess({ visibility: v })} />
                  {v === 'org' ? 'Everyone in the org' : 'Only who I pick'}
                </label>
              ))}
            </div>
            {form.access.visibility === 'restricted' && (
              <div className="space-y-2">
                <div>
                  <label className={label}>Roles</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {audience.roles.map((r) => (
                      <button type="button" key={r} onClick={() => setAccess({ allowRoles: toggle(form.access.allowRoles, r) })}
                        className={`px-2.5 py-1 rounded-full text-xs border ${form.access.allowRoles.includes(r) ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 border-gray-300'}`}>{r}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={label}>Teams</label>
                  <div className="flex gap-1.5 flex-wrap max-h-20 overflow-y-auto">
                    {audience.teams.map((t) => (
                      <button type="button" key={t._id} onClick={() => setAccess({ allowTeams: toggle(form.access.allowTeams, t._id) })}
                        className={`px-2.5 py-1 rounded-full text-xs border ${form.access.allowTeams.includes(t._id) ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 border-gray-300'}`}>{t.name}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={label}>People</label>
                  <select multiple value={form.access.allowUserIds} size={5}
                    onChange={(e) => setAccess({ allowUserIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
                    className={input}>
                    {audience.users.map((u) => <option key={u._id} value={u._id}>{u.name} · {u.role}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div>
              <label className={label}>Never allow <span className="text-gray-400 font-normal">(wins over everything, including admin)</span></label>
              <select multiple value={form.access.denyUserIds} size={3}
                onChange={(e) => setAccess({ denyUserIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
                className={input}>
                {audience.users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className={group}>
            <span className={legend}>Approval</span>
            <div className="flex gap-4 text-sm">
              {[['instant', 'First come, first served'], ['approval', 'I approve each request']].map(([v, txt]) => (
                <label key={v} className="flex items-center gap-2">
                  <input type="radio" name="claimMode" checked={form.claimMode === v} onChange={() => set({ claimMode: v })} />{txt}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Cancellable until (min before)</label>
                <input type="number" min="0" value={form.cancellableUntilMinutesBefore ?? ''} onChange={(e) => set({ cancellableUntilMinutesBefore: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="any time" className={input} />
              </div>
              <div><label className={label}>Status</label>
                <select value={form.status} onChange={(e) => set({ status: e.target.value })} className={input}>
                  <option value="open">Open</option><option value="paused">Paused</option><option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}{block ? 'Save changes' : 'Create block'}
            </button>
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

  useEffect(() => { load(); }, [load]);

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
                  {new Date(c.startTime).toLocaleString('en-GB', { timeZone: displayTz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {c.minutes} min
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
        anchorDate={anchor}
        timezone={displayTz}
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
          onClose={() => setPending(null)}
          onDone={() => { setPending(null); load(anchor); }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────  The claim panel  ─────────────────────────── */

function ClaimPanel({ block, range, onClose, onDone }) {
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
            <div className="text-sm">{range.startTime} – {range.endTime} · {minutes} min</div>
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
