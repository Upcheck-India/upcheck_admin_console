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
  Plus,
  Link2,
  Unlink,
  Wand2,
  CheckCircle2,
  Landmark,
} from 'lucide-react';
import useBillingAccount from '../../funds/_hooks/useBillingAccount';
import AccountSelector from '../../funds/_components/AccountSelector';
import { numberFmt } from '../../funds/_components/constants';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' }) : '—');

export default function ReconciliationPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');
  const { accounts, activeAccountId, selectAccount } = useBillingAccount();

  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [showStatement, setShowStatement] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    if (!activeAccountId) { setData(null); return; }
    try {
      setLoading(true);
      const params = new URLSearchParams({ accountId: activeAccountId });
      if (range.startDate) params.set('startDate', range.startDate);
      if (range.endDate) params.set('endDate', range.endDate);
      const res = await fetch(`/api/organization/bank-reconciliation?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load reconciliation');
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, range]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const doMatch = useCallback(async (bankTxnId, journalId) => {
    try {
      const res = await fetch('/api/organization/bank-reconciliation/match', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankTxnId, journalId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to match');
      setSelectedTxn(null);
      showToast('Matched');
      await load();
    } catch (e) {
      setError(e.message);
    }
  }, [load, showToast]);

  const doUnmatch = useCallback(async (bankTxnId) => {
    try {
      const res = await fetch('/api/organization/bank-reconciliation/match', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankTxnId, unmatch: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to unmatch');
      showToast('Unmatched');
      await load();
    } catch (e) {
      setError(e.message);
    }
  }, [load, showToast]);

  const doAutoMatch = useCallback(async () => {
    if (!activeAccountId) return;
    try {
      setAutoBusy(true);
      const res = await fetch('/api/organization/bank-reconciliation/match', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto: true, accountId: activeAccountId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Auto-match failed');
      showToast(`Auto-matched ${d.matched} transaction(s)`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAutoBusy(false);
    }
  }, [activeAccountId, load, showToast]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAdmin) return <UnauthorizedAccess />;

  const summary = data?.summary;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/organization/finance" className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl" title="Back to Finance">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                Bank Reconciliation
              </span>
            </div>
            <AccountSelector accounts={accounts} activeAccountId={activeAccountId || ''} onSelect={(id) => selectAccount(id)} />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <nav className="flex items-center gap-2 text-sm text-slate-600 mb-6" aria-label="Breadcrumb">
          <Link href="/organization/finance" className="hover:text-indigo-600">Finance</Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <span className="text-slate-900 font-medium">Bank Reconciliation</span>
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

        {!activeAccountId ? (
          <div className="py-16 text-center text-slate-500 bg-white rounded-2xl border-2 border-dashed border-slate-300">
            Select a billing account to reconcile.
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-6 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Start date</label>
                <input type="date" className="border rounded-xl px-3 py-2" value={range.startDate} onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">End date</label>
                <input type="date" className="border rounded-xl px-3 py-2" value={range.endDate} onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))} />
              </div>
              <button onClick={load} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">Apply</button>
              <div className="flex-1" />
              <button onClick={doAutoMatch} disabled={autoBusy} className="px-4 py-2 rounded-xl border border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 disabled:opacity-50">
                {autoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Auto-match
              </button>
              <button onClick={() => setShowStatement(true)} className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add statement
              </button>
            </div>

            {summary && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <SummaryCard label="Book balance (GL)" value={numberFmt(summary.bookBalance)} />
                <SummaryCard label="Statement balance" value={numberFmt(summary.statementBalance)} />
                <SummaryCard label="Difference" value={numberFmt(summary.difference)} highlight={summary.reconciled ? 'green' : 'amber'} />
                <SummaryCard label="Unreconciled" value={`${summary.unreconciledBookCount} book / ${summary.unreconciledBankCount} bank`} />
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" /> Loading…
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Book side */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b flex items-center gap-2 font-semibold text-slate-900">
                    <Landmark className="w-4 h-4 text-indigo-600" /> Book side — GL Bank (1000)
                  </div>
                  <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Date</th>
                          <th className="text-left px-3 py-2 font-medium">Description</th>
                          <th className="text-right px-3 py-2 font-medium">Debit</th>
                          <th className="text-right px-3 py-2 font-medium">Credit</th>
                          <th className="px-2 py-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(data?.book || []).length === 0 ? (
                          <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No book entries.</td></tr>
                        ) : data.book.map((b) => (
                          <tr key={b.journalId} className={selectedTxn && !b.reconciled ? 'cursor-pointer hover:bg-indigo-50' : ''} onClick={() => selectedTxn && !b.reconciled && doMatch(selectedTxn._id, b.journalId)}>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(b.date)}</td>
                            <td className="px-3 py-2">{b.description}</td>
                            <td className="px-3 py-2 text-right">{b.debit ? numberFmt(b.debit) : ''}</td>
                            <td className="px-3 py-2 text-right">{b.credit ? numberFmt(b.credit) : ''}</td>
                            <td className="px-2 py-2 text-center">{b.reconciled && <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selectedTxn && (
                    <div className="p-3 bg-indigo-50 text-indigo-800 text-sm border-t border-indigo-200">
                      Click a book row to match it to the selected bank transaction ({numberFmt(selectedTxn.amount)}).
                      <button className="ml-2 underline" onClick={() => setSelectedTxn(null)}>Cancel</button>
                    </div>
                  )}
                </div>

                {/* Bank side */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b flex items-center gap-2 font-semibold text-slate-900">
                    <Landmark className="w-4 h-4 text-emerald-600" /> Bank side — statement lines
                  </div>
                  <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Date</th>
                          <th className="text-left px-3 py-2 font-medium">Description</th>
                          <th className="text-right px-3 py-2 font-medium">Amount</th>
                          <th className="px-2 py-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(data?.bank || []).length === 0 ? (
                          <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">No bank transactions. Add a statement to import lines.</td></tr>
                        ) : data.bank.map((t) => (
                          <tr key={t._id} className={t.reconciled ? 'bg-emerald-50/40' : ''}>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(t.date)}</td>
                            <td className="px-3 py-2">{t.description}</td>
                            <td className={`px-3 py-2 text-right ${t.amount < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{numberFmt(t.amount)}</td>
                            <td className="px-2 py-2 text-right whitespace-nowrap">
                              {t.reconciled ? (
                                <button onClick={() => doUnmatch(t._id)} className="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1">
                                  <Unlink className="w-3 h-3" /> Unmatch
                                </button>
                              ) : (
                                <button onClick={() => setSelectedTxn(t)} className={`text-xs px-2 py-1 rounded-lg border inline-flex items-center gap-1 ${selectedTxn?._id === t._id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'}`}>
                                  <Link2 className="w-3 h-3" /> Match
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showStatement && (
        <StatementModal
          accountId={activeAccountId}
          onClose={() => setShowStatement(false)}
          onCreated={(n) => {
            setShowStatement(false);
            showToast(`Statement added with ${n} line(s)`);
            load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, highlight }) {
  const cls = highlight === 'green'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : highlight === 'amber'
      ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-white border-slate-200 text-slate-900';
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-xs opacity-70 mb-1">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function StatementModal({ accountId, onClose, onCreated, onError }) {
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const [note, setNote] = useState('');
  const [pasted, setPasted] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  // Parse pasted lines: "YYYY-MM-DD, description, amount" (one per line).
  const parseLines = () => pasted
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const parts = row.split(/[,\t]/).map((p) => p.trim());
      const [date, description, amount] = parts.length >= 3 ? parts : [null, parts[0], parts[1]];
      return { date: date || statementDate, description: description || '', amount: Number(amount) || 0 };
    });

  const previewLines = parseLines();

  const submit = async () => {
    setLocalError(null);
    try {
      setSaving(true);
      const res = await fetch('/api/organization/bank-reconciliation/statements', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          statementDate,
          openingBalance: Number(openingBalance) || 0,
          closingBalance: Number(closingBalance) || 0,
          note,
          lines: previewLines,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to create statement');
      onCreated(d.insertedTxns || 0);
    } catch (e) {
      setLocalError(e.message);
      if (onError) onError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Add bank statement</h3>
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
              <label className="block text-xs text-slate-500 mb-1">Statement date</label>
              <input type="date" className="w-full border rounded-xl px-3 py-2" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Opening balance (₹)</label>
              <input type="number" step="0.01" className="w-full border rounded-xl px-3 py-2" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Closing balance (₹)</label>
              <input type="number" step="0.01" className="w-full border rounded-xl px-3 py-2" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Note</label>
            <input className="w-full border rounded-xl px-3 py-2" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Lines — one per row: date, description, amount (+ inflow / − outflow)</label>
            <textarea
              className="w-full border rounded-xl px-3 py-2 font-mono text-xs h-32"
              placeholder={'2026-07-01, Grant received, 50000\n2026-07-03, Bank charges, -250'}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <div className="text-xs text-slate-500 mt-1">{previewLines.length} line(s) parsed.</div>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save statement
          </button>
        </div>
      </div>
    </div>
  );
}
