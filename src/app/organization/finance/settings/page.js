'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import UnauthorizedAccess from '../../../../components/UnauthorizedAccess';
import {
  ArrowLeft, ShieldAlert, RefreshCw, Trash2, RotateCcw, Database,
  AlertTriangle, CheckCircle2, Loader2, FlaskConical, Rocket,
} from 'lucide-react';

const RESET_PHRASE = 'RESET FINANCE';
const RESTORE_PHRASE = 'RESTORE FINANCE';

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toLocaleString('en-IN'); } catch { return String(v); }
}

export default function FinanceSettingsPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(null);
  const [modes, setModes] = useState(['test', 'production']);
  const [collections, setCollections] = useState([]);
  const [backups, setBackups] = useState([]);

  // reset form state
  const [selected, setSelected] = useState({}); // name -> bool
  const [doBackup, setDoBackup] = useState(true);
  const [targetMode, setTargetMode] = useState('test');
  const [note, setNote] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sRes, bRes] = await Promise.all([
        fetch('/api/organization/finance/settings', { credentials: 'include' }),
        fetch('/api/organization/finance/backups', { credentials: 'include' }),
      ]);
      if (!sRes.ok) throw new Error((await sRes.json().catch(() => ({}))).error || 'Failed to load settings');
      const s = await sRes.json();
      setSettings(s.settings);
      setModes(s.modes || ['test', 'production']);
      setCollections(s.collections || []);
      setTargetMode(s.settings?.mode || 'test');
      const sel = {};
      (s.collections || []).forEach((c) => { sel[c.name] = true; });
      setSelected(sel);
      if (bRes.ok) setBackups((await bRes.json()).backups || []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin, loadAll]);

  const grouped = useMemo(() => {
    const g = {};
    collections.forEach((c) => { (g[c.group] = g[c.group] || []).push(c); });
    return g;
  }, [collections]);

  const selectedNames = useMemo(() => collections.filter((c) => selected[c.name]).map((c) => c.name), [collections, selected]);

  const switchMode = async (mode) => {
    if (mode === settings?.mode) return;
    if (!window.confirm(`Switch finance to ${mode.toUpperCase()} mode? This does NOT delete any data.`)) return;
    try {
      setBusy(true);
      const res = await fetch('/api/organization/finance/settings', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to switch mode');
      setSettings(d.settings);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runReset = async () => {
    if (confirmText !== RESET_PHRASE) return;
    if (selectedNames.length === 0) { setError('Select at least one data set to reset.'); return; }
    if (!window.confirm('This permanently deletes the selected finance data. Continue?')) return;
    try {
      setBusy(true);
      setError(null);
      setResult(null);
      const res = await fetch('/api/organization/finance/reset', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmPhrase: confirmText, backup: doBackup, targetMode, collections: selectedNames, note }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Reset failed');
      setResult(d);
      setConfirmText('');
      setNote('');
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (id) => {
    const phrase = window.prompt(`Restore this backup? This OVERWRITES current finance data.\n\nType "${RESTORE_PHRASE}" to confirm:`);
    if (phrase == null) return;
    try {
      setBusy(true);
      setError(null);
      const res = await fetch(`/api/organization/finance/backups/${id}/restore`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmPhrase: phrase }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Restore failed');
      setResult({ restored: d.restored, safetyBackupId: d.safetyBackupId });
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteBackup = async (id) => {
    if (!window.confirm('Delete this backup permanently? It can no longer be restored.')) return;
    try {
      setBusy(true);
      const res = await fetch(`/api/organization/finance/backups/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Delete failed');
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (!isAdmin) return <UnauthorizedAccess />;

  const mode = settings?.mode || 'test';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50/30">
      <nav className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link href="/organization/finance" className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl" title="Back to Finance">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-600" />
            <span className="text-lg font-bold text-slate-900">Finance Settings &amp; Danger Zone</span>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="text-sm text-slate-600">
          <Link href="/organization/finance" className="hover:text-indigo-600">Finance</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-900 font-medium">Settings</span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" /> Done</div>
            <pre className="text-xs mt-2 whitespace-pre-wrap break-all">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>
        ) : (
          <>
            {/* Mode */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Finance mode</h2>
              <p className="text-sm text-slate-600 mb-4">
                Test mode is for trial runs before go-live. Switching mode does <strong>not</strong> delete anything.
                Use the reset below to wipe test data and start clean.
              </p>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${mode === 'production' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {mode === 'production' ? <Rocket className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
                  {mode.toUpperCase()}
                </span>
                <div className="flex gap-2">
                  {modes.map((m) => (
                    <button key={m} onClick={() => switchMode(m)} disabled={busy || m === mode}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${m === mode ? 'bg-slate-100 text-slate-400 cursor-default' : 'bg-white hover:bg-slate-50 text-slate-700'}`}>
                      Switch to {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-3">
                Last reset: {fmtDate(settings?.lastResetAt)} {settings?.lastResetBy?.username ? `by ${settings.lastResetBy.username}` : ''}
              </div>
            </section>

            {/* Danger zone: reset */}
            <section className="bg-white rounded-2xl border-2 border-red-200 p-6">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="h-5 w-5 text-red-600" />
                <h2 className="text-lg font-bold text-red-700">Master reset</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Permanently deletes the selected finance data so the module is fresh and clean. Very dangerous — not
                recommended often. A backup is taken first by default so you can restore. Admins only.
              </p>

              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                {Object.keys(grouped).sort().map((g) => (
                  <div key={g} className="border border-slate-200 rounded-xl p-3">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{g}</div>
                    <div className="space-y-1.5">
                      {grouped[g].map((c) => (
                        <label key={c.name} className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" checked={!!selected[c.name]}
                            onChange={(e) => setSelected((p) => ({ ...p, [c.name]: e.target.checked }))} />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4 mb-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={doBackup} onChange={(e) => setDoBackup(e.target.checked)} />
                  <Database className="h-4 w-4 text-slate-500" /> Take a backup first (recommended)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  After reset, set mode to:
                  <select value={targetMode} onChange={(e) => setTargetMode(e.target.value)} className="border rounded-lg px-2 py-1 text-sm">
                    {modes.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              </div>

              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note (e.g. 'end of test run 2')"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3" />

              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <label className="block text-sm font-medium text-red-800 mb-2">
                  Type <code className="bg-white px-1.5 py-0.5 rounded border border-red-200 font-mono">{RESET_PHRASE}</code> to confirm
                </label>
                <div className="flex gap-2">
                  <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={RESET_PHRASE}
                    className="flex-1 border border-red-300 rounded-lg px-3 py-2 text-sm font-mono" />
                  <button onClick={runReset} disabled={busy || confirmText !== RESET_PHRASE || selectedNames.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Reset finance module
                  </button>
                </div>
                <p className="text-xs text-red-600 mt-2">{selectedNames.length} data set(s) selected for deletion.</p>
              </div>
            </section>

            {/* Backups */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Backups</h2>
              {backups.length === 0 ? (
                <p className="text-sm text-slate-500">No backups yet. One is created automatically before each reset.</p>
              ) : (
                <div className="space-y-2">
                  {backups.map((b) => (
                    <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 rounded-xl px-4 py-3">
                      <div className="text-sm">
                        <div className="font-medium text-slate-800">{fmtDate(b.createdAt)} · {b.totalDocs} docs · {b.mode || '—'}</div>
                        <div className="text-xs text-slate-500">{b.note || 'No note'} · {(b.collections || []).length} collections{b.createdBy?.username ? ` · ${b.createdBy.username}` : ''}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => restore(b.id)} disabled={busy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-sm hover:bg-amber-50">
                          <RotateCcw className="h-4 w-4" /> Restore
                        </button>
                        <button onClick={() => deleteBackup(b.id)} disabled={busy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50">
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
