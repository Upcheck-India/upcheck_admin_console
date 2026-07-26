'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import UnauthorizedAccess from '../../../../components/UnauthorizedAccess';
import {
  ArrowLeft,
  ChevronDown,
  AlertCircle,
  X,
  Loader2,
  Lock,
  Unlock,
  CalendarRange,
  CheckCircle2,
} from 'lucide-react';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' }) : '—');

// India FY starts in April. Compute the FY-start year for "today".
function currentFyStart() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function fyLabel(startYear) {
  return `FY${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export default function PeriodsPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');

  const [fyStart, setFyStart] = useState(currentFyStart());
  const [periods, setPeriods] = useState([]);
  const [virtual, setVirtual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/organization/fiscal-periods?fyStart=${fyStart}`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load periods');
      const data = await res.json();
      setPeriods(data.periods || []);
      setVirtual(!!data.virtual);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fyStart]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const materialize = useCallback(async () => {
    setError(null);
    try {
      setLoading(true);
      const res = await fetch('/api/organization/fiscal-periods', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fyStart }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create periods');
      showToast(`Materialized 12 months for ${fyLabel(fyStart)}`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fyStart, load, showToast]);

  const toggle = useCallback(async (period) => {
    const closing = period.status !== 'closed';
    if (closing && !confirm(`Close ${period.label}? Posting into this period will be blocked.`)) return;
    setError(null);
    setBusyKey(period.key);
    try {
      const res = await fetch(`/api/organization/fiscal-periods/${period.key}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: closing ? 'closed' : 'open' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update period');
      showToast(closing ? `${period.label} closed` : `${period.label} reopened`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  }, [load, showToast]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAdmin) return <UnauthorizedAccess />;

  const yearOptions = [];
  const base = currentFyStart();
  for (let y = base + 1; y >= base - 6; y -= 1) yearOptions.push(y);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <Link href="/organization/finance" className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl" title="Back to Finance">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              Fiscal Periods
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <nav className="flex items-center gap-2 text-sm text-slate-600 mb-6" aria-label="Breadcrumb">
          <Link href="/organization/finance" className="hover:text-indigo-600">Finance</Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <span className="text-slate-900 font-medium">Fiscal Periods</span>
        </nav>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 flex items-center gap-3 border border-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss"><X className="w-4 h-4" /></button>
          </div>
        )}
        {toast && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 text-emerald-800 flex items-center gap-3 border border-emerald-200">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">{toast}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-6 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Fiscal year</label>
            <select className="border rounded-xl px-3 py-2 bg-white" value={fyStart} onChange={(e) => setFyStart(Number(e.target.value))}>
              {yearOptions.map((y) => <option key={y} value={y}>{fyLabel(y)} (Apr {y} – Mar {y + 1})</option>)}
            </select>
          </div>
          {virtual && (
            <button onClick={materialize} disabled={loading} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              <CalendarRange className="w-4 h-4" /> Materialize 12 months
            </button>
          )}
          {virtual && <span className="text-sm text-amber-700">These periods are not created yet — materialize them to close/reopen.</span>}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" /> Loading periods…
          </div>
        ) : periods.length === 0 ? (
          <div className="py-16 text-center text-slate-500 bg-white rounded-2xl border-2 border-dashed border-slate-300">No periods.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {periods.map((p) => {
              const closed = p.status === 'closed';
              return (
                <div key={p.key} className={`rounded-2xl border p-4 ${closed ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-slate-900">{p.label}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${closed ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {closed ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      {closed ? 'Closed' : 'Open'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mb-3">
                    {fmtDate(p.start)} – {fmtDate(new Date(new Date(p.end).getTime() - 1))}
                    {closed && p.closedAt && <div className="mt-1">Closed {fmtDate(p.closedAt)}{p.closedBy?.username ? ` by ${p.closedBy.username}` : ''}</div>}
                  </div>
                  <button
                    onClick={() => toggle(p)}
                    disabled={busyKey === p.key || virtual}
                    className={`w-full px-3 py-2 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${closed ? 'border border-slate-300 text-slate-700 hover:bg-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                    title={virtual ? 'Materialize the fiscal year first' : ''}
                  >
                    {busyKey === p.key ? <Loader2 className="w-4 h-4 animate-spin" /> : closed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {closed ? 'Reopen' : 'Close'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
