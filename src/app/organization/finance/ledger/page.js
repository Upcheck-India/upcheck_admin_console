'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import UnauthorizedAccess from '../../../../components/UnauthorizedAccess';
import {
  ArrowLeft,
  ChevronDown,
  Plus,
  X,
  AlertCircle,
  Loader2,
  BookOpen,
  Table2,
  ListTree,
  Trash2,
  Database,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import useBillingAccount from '../../funds/_hooks/useBillingAccount';
import { numberFmt } from '../../funds/_components/constants';

const fmtMinor = (m) => numberFmt((Number(m) || 0) / 100);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' }) : '—');

const TYPE_BADGE = {
  asset: 'bg-blue-50 text-blue-700 border-blue-200',
  liability: 'bg-amber-50 text-amber-700 border-amber-200',
  equity: 'bg-purple-50 text-purple-700 border-purple-200',
  income: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expense: 'bg-rose-50 text-rose-700 border-rose-200',
  unknown: 'bg-slate-50 text-slate-600 border-slate-200',
};

const EMPTY_LINE = { accountCode: '', debit: '', credit: '', memo: '' };

export default function LedgerPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');
  const { accounts: billingAccounts, activeAccountId } = useBillingAccount();

  const [tab, setTab] = useState('chart');
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Chart of accounts
  const [chart, setChart] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [types, setTypes] = useState([]);
  const [newAccount, setNewAccount] = useState({ code: '', name: '', type: 'expense' });
  const [savingAccount, setSavingAccount] = useState(false);

  // Journal
  const [entries, setEntries] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [showJournalModal, setShowJournalModal] = useState(false);

  // Trial balance
  const [tb, setTb] = useState(null);
  const [tbLoading, setTbLoading] = useState(false);
  const [tbRange, setTbRange] = useState({ startDate: '', endDate: '', accountId: '' });

  const [backfilling, setBackfilling] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadChart = useCallback(async () => {
    try {
      setChartLoading(true);
      const res = await fetch('/api/organization/gl/accounts?includeInactive=true', { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load chart');
      const data = await res.json();
      setChart(data.accounts || []);
      setTypes(data.types || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setChartLoading(false);
    }
  }, []);

  const loadJournal = useCallback(async () => {
    try {
      setJournalLoading(true);
      const res = await fetch('/api/organization/gl/journal?limit=200', { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load journal');
      const data = await res.json();
      setEntries(data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setJournalLoading(false);
    }
  }, []);

  const loadTrialBalance = useCallback(async () => {
    try {
      setTbLoading(true);
      const params = new URLSearchParams();
      if (tbRange.startDate) params.set('startDate', tbRange.startDate);
      if (tbRange.endDate) params.set('endDate', tbRange.endDate);
      if (tbRange.accountId) params.set('accountId', tbRange.accountId);
      const res = await fetch(`/api/organization/gl/trial-balance?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load trial balance');
      setTb(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setTbLoading(false);
    }
  }, [tbRange]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'chart') loadChart();
    if (tab === 'journal') loadJournal();
    if (tab === 'trial') loadTrialBalance();
  }, [isAdmin, tab, loadChart, loadJournal, loadTrialBalance]);

  const handleAddAccount = useCallback(async () => {
    setError(null);
    if (!/^\d{3,6}$/.test(newAccount.code.trim())) { setError('Account code must be 3–6 digits'); return; }
    if (!newAccount.name.trim()) { setError('Account name is required'); return; }
    try {
      setSavingAccount(true);
      const res = await fetch('/api/organization/gl/accounts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to add account');
      setNewAccount({ code: '', name: '', type: 'expense' });
      showToast('Account added');
      await loadChart();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingAccount(false);
    }
  }, [newAccount, loadChart, showToast]);

  const handleToggleAccount = useCallback(async (acc) => {
    try {
      const res = await fetch(`/api/organization/gl/accounts/${acc._id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: acc.active === false }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update account');
      await loadChart();
    } catch (e) {
      setError(e.message);
    }
  }, [loadChart]);

  const handleDeleteAccount = useCallback(async (acc) => {
    if (!confirm(`Deactivate account ${acc.code} — ${acc.name}?`)) return;
    try {
      const res = await fetch(`/api/organization/gl/accounts/${acc._id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete account');
      showToast('Account deactivated');
      await loadChart();
    } catch (e) {
      setError(e.message);
    }
  }, [loadChart, showToast]);

  const handleBackfill = useCallback(async () => {
    if (!confirm('Mirror the existing cashbook into the General Ledger? This is idempotent and safe to re-run.')) return;
    setError(null);
    try {
      setBackfilling(true);
      const res = await fetch('/api/organization/gl/backfill', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backfill failed');
      showToast(`Backfill complete — posted ${data.posted}, already present ${data.alreadyPresent}, skipped ${data.skipped}, reversed ${data.reversed}`);
      if (tab === 'journal') loadJournal();
      if (tab === 'trial') loadTrialBalance();
    } catch (e) {
      setError(e.message);
    } finally {
      setBackfilling(false);
    }
  }, [showToast, tab, loadJournal, loadTrialBalance]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAdmin) return <UnauthorizedAccess />;

  const tabs = [
    { key: 'chart', label: 'Chart of Accounts', icon: <ListTree className="w-4 h-4" /> },
    { key: 'journal', label: 'Journal', icon: <BookOpen className="w-4 h-4" /> },
    { key: 'trial', label: 'Trial Balance', icon: <Table2 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-4">
              <Link href="/organization/finance" className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl" title="Back to Finance">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                General Ledger
              </span>
            </div>
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 flex items-center gap-2 shadow-md disabled:opacity-50"
              title="Mirror the cashbook into the GL"
            >
              {backfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              <span className="hidden sm:inline">Backfill from cashbook</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <nav className="flex items-center gap-2 text-sm text-slate-600 mb-6" aria-label="Breadcrumb">
          <Link href="/organization/finance" className="hover:text-indigo-600">Finance</Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <span className="text-slate-900 font-medium">General Ledger</span>
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

        <div className="flex gap-2 mb-6 border-b border-slate-200 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                tab === t.key ? 'border-indigo-600 text-indigo-700 font-medium' : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'chart' && (
          <ChartTab
            chart={chart}
            loading={chartLoading}
            types={types}
            newAccount={newAccount}
            setNewAccount={setNewAccount}
            onAdd={handleAddAccount}
            saving={savingAccount}
            onToggle={handleToggleAccount}
            onDelete={handleDeleteAccount}
            onReload={loadChart}
          />
        )}

        {tab === 'journal' && (
          <JournalTab
            entries={entries}
            loading={journalLoading}
            expanded={expanded}
            setExpanded={setExpanded}
            onNew={() => setShowJournalModal(true)}
          />
        )}

        {tab === 'trial' && (
          <TrialBalanceTab
            tb={tb}
            loading={tbLoading}
            range={tbRange}
            setRange={setTbRange}
            onApply={loadTrialBalance}
            billingAccounts={billingAccounts}
          />
        )}
      </div>

      {showJournalModal && (
        <JournalModal
          chart={chart.filter((a) => a.active !== false)}
          activeAccountId={activeAccountId}
          onClose={() => setShowJournalModal(false)}
          onPosted={() => {
            setShowJournalModal(false);
            showToast('Journal entry posted');
            loadJournal();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function ChartTab({ chart, loading, types, newAccount, setNewAccount, onAdd, saving, onToggle, onDelete, onReload }) {
  if (loading) return <Loading label="Loading chart of accounts…" />;
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200">
        <h2 className="text-lg font-semibold mb-3">Add a custom account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input className="border rounded-xl px-3 py-2" placeholder="Code (e.g. 5700)" value={newAccount.code} onChange={(e) => setNewAccount((a) => ({ ...a, code: e.target.value }))} />
          <input className="border rounded-xl px-3 py-2 sm:col-span-2" placeholder="Account name" value={newAccount.name} onChange={(e) => setNewAccount((a) => ({ ...a, name: e.target.value }))} />
          <div className="flex gap-2">
            <select className="border rounded-xl px-2 py-2 bg-white flex-1" value={newAccount.type} onChange={(e) => setNewAccount((a) => ({ ...a, type: e.target.value }))}>
              {(types.length ? types : ['asset', 'liability', 'equity', 'income', 'expense']).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button onClick={onAdd} disabled={saving} className="px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Chart of Accounts</h2>
          <button onClick={onReload} className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50 flex items-center gap-1 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        {chart.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <p className="mb-4">No accounts yet.</p>
            <button onClick={onReload} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">Seed standard chart</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Code</th>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="text-left px-4 py-2 font-medium">Normal</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-right px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chart.map((a) => (
                  <tr key={a._id || a.code} className={a.active === false ? 'opacity-50' : ''}>
                    <td className="px-4 py-2 font-mono">{a.code}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{a.name}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_BADGE[a.type] || TYPE_BADGE.unknown}`}>{a.type}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{a.normalBalance}</td>
                    <td className="px-4 py-2">
                      {a.system ? <span className="text-xs text-slate-400">system</span> : <span className="text-xs text-indigo-600">custom</span>}
                      {a.active === false && <span className="ml-2 text-xs text-slate-400">inactive</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {a._id && (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => onToggle(a)} className="text-xs px-2 py-1 rounded-lg border hover:bg-slate-50">
                            {a.active === false ? 'Activate' : 'Deactivate'}
                          </button>
                          {!a.system && (
                            <button onClick={() => onDelete(a)} className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function JournalTab({ entries, loading, expanded, setExpanded, onNew }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Journal Entries</h2>
        <button onClick={onNew} className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 flex items-center gap-2 shadow-md">
          <Plus className="w-4 h-4" /> New journal entry
        </button>
      </div>
      {loading ? (
        <Loading label="Loading journal…" />
      ) : entries.length === 0 ? (
        <Empty label="No journal entries yet. Post a manual entry or run a backfill." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {entries.map((e) => (
            <div key={e._id}>
              <button onClick={() => setExpanded(expanded === e._id ? null : e._id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 truncate">{e.description || '(no description)'}</div>
                  <div className="text-xs text-slate-500">
                    {fmtDate(e.date)} • <span className="font-mono">{e.source}</span> • {e.periodMonth}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-semibold text-slate-900">{fmtMinor(e.debitTotalMinor)}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded === e._id ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {expanded === e._id && (
                <div className="px-4 pb-4">
                  <table className="w-full text-sm border border-slate-100 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium">Account</th>
                        <th className="text-right px-3 py-1.5 font-medium">Debit</th>
                        <th className="text-right px-3 py-1.5 font-medium">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(e.lines || []).map((l, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5">
                            <span className="font-mono text-slate-500">{l.accountCode}</span> {l.accountName}
                            {l.memo && <span className="text-xs text-slate-400"> — {l.memo}</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right">{l.debitMinor ? fmtMinor(l.debitMinor) : ''}</td>
                          <td className="px-3 py-1.5 text-right">{l.creditMinor ? fmtMinor(l.creditMinor) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-semibold">
                      <tr>
                        <td className="px-3 py-1.5 text-right">Totals</td>
                        <td className="px-3 py-1.5 text-right">{fmtMinor(e.debitTotalMinor)}</td>
                        <td className="px-3 py-1.5 text-right">{fmtMinor(e.creditTotalMinor)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrialBalanceTab({ tb, loading, range, setRange, onApply, billingAccounts }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Start date</label>
          <input type="date" className="border rounded-xl px-3 py-2" value={range.startDate} onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">End date</label>
          <input type="date" className="border rounded-xl px-3 py-2" value={range.endDate} onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Billing account</label>
          <select className="border rounded-xl px-3 py-2 bg-white" value={range.accountId} onChange={(e) => setRange((r) => ({ ...r, accountId: e.target.value }))}>
            <option value="">All accounts</option>
            {(billingAccounts || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <button onClick={onApply} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">Apply</button>
      </div>

      {loading ? (
        <Loading label="Computing trial balance…" />
      ) : !tb || (tb.accounts || []).length === 0 ? (
        <Empty label="No postings in this range. Try a wider range or run a backfill." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Code</th>
                  <th className="text-left px-4 py-2 font-medium">Account</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="text-right px-4 py-2 font-medium">Debit</th>
                  <th className="text-right px-4 py-2 font-medium">Credit</th>
                  <th className="text-right px-4 py-2 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tb.accounts.map((a) => (
                  <tr key={a.code}>
                    <td className="px-4 py-2 font-mono text-slate-500">{a.code}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{a.name}</td>
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_BADGE[a.type] || TYPE_BADGE.unknown}`}>{a.type}</span></td>
                    <td className="px-4 py-2 text-right">{a.debit ? numberFmt(a.debit) : ''}</td>
                    <td className="px-4 py-2 text-right">{a.credit ? numberFmt(a.credit) : ''}</td>
                    <td className="px-4 py-2 text-right font-medium">{numberFmt(a.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr>
                  <td className="px-4 py-2" colSpan={3}>
                    Totals {tb.totals.balanced ? <span className="text-emerald-600 text-xs ml-2">balanced</span> : <span className="text-red-600 text-xs ml-2">out of balance</span>}
                  </td>
                  <td className="px-4 py-2 text-right">{numberFmt(tb.totals.totalDebit)}</td>
                  <td className="px-4 py-2 text-right">{numberFmt(tb.totals.totalCredit)}</td>
                  <td className="px-4 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function JournalModal({ chart, activeAccountId, onClose, onPosted, onError }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  const [posting, setPosting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const debitTotal = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const creditTotal = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(debitTotal - creditTotal) < 0.005 && debitTotal > 0;

  const updateLine = (i, patch) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  const removeLine = (i) => setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));

  const submit = async () => {
    setLocalError(null);
    const payloadLines = lines
      .filter((l) => l.accountCode && (Number(l.debit) > 0 || Number(l.credit) > 0))
      .map((l) => ({
        accountCode: l.accountCode,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        memo: l.memo || undefined,
        accountId: activeAccountId || undefined,
      }));
    if (payloadLines.length < 2) { setLocalError('At least two lines with amounts are required'); return; }
    try {
      setPosting(true);
      const res = await fetch('/api/organization/gl/journal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, description, lines: payloadLines, accountId: activeAccountId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post journal');
      onPosted();
    } catch (e) {
      setLocalError(e.message);
      if (onError) onError(e.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">New journal entry</h3>
          <button onClick={onClose} aria-label="Close"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-4 space-y-4">
          {localError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {localError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Date</label>
              <input type="date" className="w-full border rounded-xl px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Description</label>
              <input className="w-full border rounded-xl px-3 py-2" placeholder="e.g. Bank charges for July" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Account</th>
                  <th className="text-right px-3 py-2 font-medium">Debit (₹)</th>
                  <th className="text-right px-3 py-2 font-medium">Credit (₹)</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <select className="w-full border rounded-lg px-2 py-1.5 bg-white" value={l.accountCode} onChange={(e) => updateLine(i, { accountCode: e.target.value })}>
                        <option value="">Select account…</option>
                        {chart.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                      </select>
                      <input className="w-full border rounded-lg px-2 py-1 mt-1 text-xs" placeholder="Memo (optional)" value={l.memo} onChange={(e) => updateLine(i, { memo: e.target.value })} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" step="0.01" min="0" className="w-28 border rounded-lg px-2 py-1.5 text-right" value={l.debit} onChange={(e) => updateLine(i, { debit: e.target.value, credit: '' })} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" step="0.01" min="0" className="w-28 border rounded-lg px-2 py-1.5 text-right" value={l.credit} onChange={(e) => updateLine(i, { credit: e.target.value, debit: '' })} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => removeLine(i)} disabled={lines.length <= 2} className="text-slate-400 hover:text-red-600 disabled:opacity-30" aria-label="Remove line">
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr>
                  <td className="px-3 py-2">
                    <button onClick={addLine} className="text-indigo-600 text-sm flex items-center gap-1 font-normal"><Plus className="w-4 h-4" /> Add line</button>
                  </td>
                  <td className="px-3 py-2 text-right">{numberFmt(debitTotal)}</td>
                  <td className="px-3 py-2 text-right">{numberFmt(creditTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className={`text-sm px-3 py-2 rounded-lg ${balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {balanced ? 'Balanced — ready to post.' : `Not balanced — debits ${numberFmt(debitTotal)} vs credits ${numberFmt(creditTotal)}.`}
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border">Cancel</button>
          <button onClick={submit} disabled={!balanced || posting} className={`px-4 py-2 rounded-xl text-white flex items-center gap-2 ${!balanced || posting ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Post entry
          </button>
        </div>
      </div>
    </div>
  );
}

function Loading({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
      {label}
    </div>
  );
}

function Empty({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-300 text-slate-500">
      {label}
    </div>
  );
}
