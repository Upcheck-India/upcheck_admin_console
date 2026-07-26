'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import UnauthorizedAccess from '../../../../components/UnauthorizedAccess';
import useOnlineUsers from '../../../../hooks/useOnlineUsers';
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  FileDown,
  Loader2,
  Lock,
  LockOpen,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import OrgNavbar from '../../funds/_components/Navbar';
import AccountSelector from '../../funds/_components/AccountSelector';
import useBillingAccount from '../../funds/_hooks/useBillingAccount';
import { numberFmt, INFLOW_TYPES, EXPENSE_TYPES } from '../../funds/_components/constants';

const PRESETS = [
  { v: 'today', l: 'Today' },
  { v: 'last7', l: 'Last 7 days' },
  { v: 'thisWeek', l: 'This week' },
  { v: 'thisMonth', l: 'This month' },
  { v: 'last30', l: 'Last 30 days' },
  { v: 'thisQuarter', l: 'This quarter' },
  { v: 'thisYear', l: 'This year' },
  { v: 'custom', l: 'Custom' },
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TYPE_LABELS = (() => {
  const map = {};
  [...INFLOW_TYPES, ...EXPENSE_TYPES].forEach((t) => { map[t.value] = t.label; });
  map.other = 'Other';
  return map;
})();

function typeLabel(value) {
  if (TYPE_LABELS[value]) return TYPE_LABELS[value];
  return String(value || 'Other')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function monthLabel(row) {
  return `${MONTH_NAMES[(row.month || 1) - 1]} ${row.year}`;
}

function csvCell(value) {
  const s = String(value == null ? '' : value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const UTIL_COLORS = { restricted: '#f59e0b', unrestricted: '#6366f1' };

export default function FinanceReportsPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');
  const onlineUsers = useOnlineUsers();

  const [username, setUsername] = useState('');
  const { accounts, activeAccount, activeAccountId, addAccount, selectAccount } = useBillingAccount();

  const [datePreset, setDatePreset] = useState('thisYear');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [excludeTransfers, setExcludeTransfers] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) setUsername(storedUsername);
  }, []);

  const isCustom = datePreset === 'custom';
  const customIncomplete = isCustom && !startDate && !endDate;

  const load = useCallback(async () => {
    if (!activeAccountId) {
      setReport(null);
      return;
    }
    if (isCustom && !startDate && !endDate) {
      // Wait until the user picks at least one bound for a custom range.
      setReport(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('accountId', activeAccountId);
      if (isCustom) {
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
      } else {
        params.append('datePreset', datePreset);
      }
      if (!excludeTransfers) params.append('excludeTransfers', 'false');
      const res = await fetch(`/api/organization/reports?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to load report');
      }
      const data = await res.json();
      setReport(data);
    } catch (e) {
      setError(e.message || 'Failed to load report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, isCustom, datePreset, startDate, endDate, excludeTransfers]);

  useEffect(() => {
    if (!authLoading && isAdmin) load();
  }, [authLoading, isAdmin, load]);

  const handleLogout = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        localStorage.removeItem('username');
        sessionStorage.clear();
        window.location.href = '/login';
      }
    } catch (e) {
      console.error('Logout failed:', e);
    }
  }, []);

  const cashflowChartData = useMemo(() => {
    if (!report?.cashflow) return [];
    return report.cashflow.map((row) => ({
      label: monthLabel(row),
      received: row.received,
      spent: row.spent,
      net: row.net,
    }));
  }, [report]);

  const utilizationPieData = useMemo(() => {
    if (!report?.fundUtilization) return [];
    const { restricted, unrestricted } = report.fundUtilization;
    return [
      { name: 'Restricted', key: 'restricted', value: Math.max(0, restricted.balance) },
      { name: 'Unrestricted', key: 'unrestricted', value: Math.max(0, unrestricted.balance) },
    ].filter((d) => d.value > 0);
  }, [report]);

  const hasData = !!report && (
    report.pnl.income.length > 0 ||
    report.pnl.expenses.length > 0 ||
    report.cashflow.length > 0
  );

  const periodLabel = useMemo(() => {
    if (!report?.period) return '';
    const fmt = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '…');
    return `${fmt(report.period.start)} – ${fmt(report.period.end)}`;
  }, [report]);

  const exportCSV = useCallback(() => {
    if (!report) return;
    const lines = [];
    lines.push(['Financial Report', activeAccount?.name || activeAccountId || ''].map(csvCell).join(','));
    lines.push(['Period', periodLabel, `Transfers ${excludeTransfers ? 'excluded' : 'included'}`].map(csvCell).join(','));
    lines.push('');
    lines.push('Profit & Loss');
    lines.push(['Section', 'Type', 'Amount (INR)'].map(csvCell).join(','));
    report.pnl.income.forEach((r) => {
      lines.push(['Income', typeLabel(r.type), r.total.toFixed(2)].map(csvCell).join(','));
    });
    lines.push(['Income', 'Total Income', report.pnl.totalIncome.toFixed(2)].map(csvCell).join(','));
    report.pnl.expenses.forEach((r) => {
      lines.push(['Expenses', typeLabel(r.type), r.total.toFixed(2)].map(csvCell).join(','));
    });
    lines.push(['Expenses', 'Total Expenses', report.pnl.totalExpenses.toFixed(2)].map(csvCell).join(','));
    lines.push(['Net', report.pnl.net >= 0 ? 'Net Surplus' : 'Net Deficit', report.pnl.net.toFixed(2)].map(csvCell).join(','));
    lines.push('');
    lines.push('Monthly Cashflow');
    lines.push(['Month', 'Received (INR)', 'Spent (INR)', 'Net (INR)'].map(csvCell).join(','));
    report.cashflow.forEach((row) => {
      lines.push([monthLabel(row), row.received.toFixed(2), row.spent.toFixed(2), row.net.toFixed(2)].map(csvCell).join(','));
    });
    lines.push('');
    lines.push('Fund Utilization');
    lines.push(['Fund', 'Received (INR)', 'Spent (INR)', 'Balance (INR)'].map(csvCell).join(','));
    ['restricted', 'unrestricted'].forEach((key) => {
      const f = report.fundUtilization[key];
      lines.push([key === 'restricted' ? 'Restricted' : 'Unrestricted', f.received.toFixed(2), f.spent.toFixed(2), f.balance.toFixed(2)].map(csvCell).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report, activeAccount, activeAccountId, periodLabel, excludeTransfers]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="relative">
          <div className="h-12 w-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-0 h-12 w-12 border-3 border-indigo-200 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isAdmin) return <UnauthorizedAccess />;

  const noAccount = !activeAccountId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 print:bg-white">
      <div className="print:hidden">
        <OrgNavbar
          title="Financial Reports"
          backHref="/organization/finance"
          onlineUsers={onlineUsers}
          user={user}
          username={username}
          onLogout={handleLogout}
        />
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-slate-600 mb-6 print:hidden" aria-label="Breadcrumb">
          <Link href="/console" className="hover:text-indigo-600 transition-colors">Console</Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <Link href="/organization" className="hover:text-indigo-600 transition-colors">Organization</Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <Link href="/organization/finance" className="hover:text-indigo-600 transition-colors">Finance</Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <span className="text-slate-900 font-medium">Reports</span>
        </nav>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div className="h-8 w-1 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full print:hidden" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent print:text-slate-900">
                Financial Reports
              </h1>
              {!!activeAccount && (
                <span className="inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Account: <span className="font-semibold">{activeAccount.name}</span>
                </span>
              )}
            </div>
            <p className="text-slate-600 ml-3">
              P&amp;L, cashflow and fund utilization
              {report && <span className="ml-2 text-slate-500">• {periodLabel}</span>}
            </p>
          </div>

          <div className="flex gap-2 flex-wrap items-center print:hidden">
            <AccountSelector
              accounts={accounts}
              activeAccountId={activeAccountId || ''}
              onSelect={(id) => selectAccount(id)}
              onAdd={(name) => addAccount(name)}
            />
            <button
              onClick={load}
              disabled={loading || noAccount}
              className="px-4 py-2 rounded-xl bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 transition-all"
              title="Refresh report"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={exportCSV}
              disabled={!report || noAccount}
              className="px-4 py-2 rounded-xl bg-white border-2 border-slate-200 text-slate-700 hover:border-green-300 hover:bg-green-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title="Download CSV"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={!report || noAccount}
              className="px-4 py-2 rounded-xl bg-white border-2 border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title="Print report"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 flex items-center gap-3 border border-red-200 print:hidden">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="hover:bg-red-100 rounded-lg p-1 transition-colors"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* No account */}
        {noAccount && (
          <div className="mb-8 bg-white rounded-2xl border-2 border-dashed border-slate-300 p-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Set up a billing account</h3>
              <p className="text-slate-600">Create or select an account to run financial reports.</p>
            </div>
            <Link href="/organization/finance/accounts" className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">Go to Accounts</Link>
          </div>
        )}

        {/* Report controls */}
        <div className="mb-6 p-6 rounded-2xl bg-white border border-slate-200 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Period</label>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                disabled={noAccount}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
              >
                {PRESETS.map((p) => (
                  <option key={p.v} value={p.v}>{p.l}</option>
                ))}
              </select>
            </div>
            {isCustom && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={noAccount}
                    className="w-full border rounded-lg px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={noAccount}
                    className="w-full border rounded-lg px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
              </>
            )}
            <div className={isCustom ? '' : 'lg:col-span-3'}>
              <label className="block text-sm font-medium text-slate-700 mb-2">Inter-account transfers</label>
              <button
                onClick={() => setExcludeTransfers((v) => !v)}
                disabled={noAccount}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg border-2 flex items-center gap-2 transition-all disabled:opacity-50 ${
                  excludeTransfers
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                {excludeTransfers ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                {excludeTransfers ? 'Transfers excluded' : 'Transfers included'}
              </button>
              <p className="text-xs text-slate-500 mt-2">
                Transfers move money between your own accounts. They are excluded by default so they don&apos;t inflate income or expenses.
              </p>
            </div>
          </div>
          {customIncomplete && !noAccount && (
            <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Pick a start and/or end date to run the custom-range report.
            </div>
          )}
        </div>

        {/* Content */}
        {loading && !report ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
            <p className="text-slate-600">Building report...</p>
          </div>
        ) : !report ? (
          !noAccount && !customIncomplete && !error ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-300">
              <BarChart3 className="w-8 h-8 text-slate-400 mb-3" />
              <p className="text-slate-600">No report loaded yet.</p>
            </div>
          ) : null
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-300">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No transactions in this period</h3>
            <p className="text-slate-600">Try a wider date range, or add entries in the Funds module.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* P&L statement */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm print:shadow-none print:border-slate-300">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Profit &amp; Loss Statement</h3>
              <p className="text-sm text-slate-500 mb-4">{periodLabel} • Transfers {excludeTransfers ? 'excluded' : 'included'}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="py-2 font-semibold text-slate-900" colSpan={2}>Income</td>
                    </tr>
                    {report.pnl.income.length === 0 && (
                      <tr>
                        <td className="py-2 pl-4 text-slate-500" colSpan={2}>No income in this period</td>
                      </tr>
                    )}
                    {report.pnl.income.map((row) => (
                      <tr key={`in-${row.type}`} className="hover:bg-slate-50">
                        <td className="py-2 pl-4 text-slate-700">{typeLabel(row.type)}</td>
                        <td className="py-2 text-right text-slate-900 tabular-nums">{numberFmt(row.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200">
                      <td className="py-2 font-semibold text-slate-900">Total Income</td>
                      <td className="py-2 text-right font-semibold text-slate-900 tabular-nums">{numberFmt(report.pnl.totalIncome)}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="pt-5 pb-2 font-semibold text-slate-900" colSpan={2}>Expenses</td>
                    </tr>
                    {report.pnl.expenses.length === 0 && (
                      <tr>
                        <td className="py-2 pl-4 text-slate-500" colSpan={2}>No expenses in this period</td>
                      </tr>
                    )}
                    {report.pnl.expenses.map((row) => (
                      <tr key={`out-${row.type}`} className="hover:bg-slate-50">
                        <td className="py-2 pl-4 text-slate-700">{typeLabel(row.type)}</td>
                        <td className="py-2 text-right text-slate-900 tabular-nums">{numberFmt(row.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200">
                      <td className="py-2 font-semibold text-slate-900">Total Expenses</td>
                      <td className="py-2 text-right font-semibold text-slate-900 tabular-nums">{numberFmt(report.pnl.totalExpenses)}</td>
                    </tr>
                    <tr className={`border-t-2 ${report.pnl.net >= 0 ? 'border-green-600' : 'border-red-600'}`}>
                      <td className={`py-3 text-base font-bold ${report.pnl.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {report.pnl.net >= 0 ? 'Net Surplus' : 'Net Deficit'}
                      </td>
                      <td className={`py-3 text-right text-base font-bold tabular-nums ${report.pnl.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {numberFmt(report.pnl.net)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cashflow chart */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm print:shadow-none print:border-slate-300">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Monthly Cashflow</h3>
              {cashflowChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={cashflowChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip formatter={(v) => numberFmt(v)} />
                    <Legend />
                    <Bar dataKey="received" fill="#10b981" name="Received" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="spent" fill="#ef4444" name="Spent" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="net" stroke="#6366f1" strokeWidth={2} name="Net" dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-500">No cashflow data</div>
              )}
            </div>

            {/* Fund utilization */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm print:shadow-none print:border-slate-300">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Fund Balances</h3>
                {utilizationPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={utilizationPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        label={(entry) => `${entry.name} ${numberFmt(entry.value)}`}
                      >
                        {utilizationPieData.map((entry) => (
                          <Cell key={`cell-util-${entry.key}`} fill={UTIL_COLORS[entry.key]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [numberFmt(v), n]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500">No positive fund balances in this period</div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6">
                {[
                  { key: 'restricted', title: 'Restricted Funds', icon: <Lock className="w-5 h-5 text-amber-600" />, chip: 'bg-amber-50 text-amber-700 border-amber-200' },
                  { key: 'unrestricted', title: 'Unrestricted Funds', icon: <LockOpen className="w-5 h-5 text-indigo-600" />, chip: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                ].map(({ key, title, icon, chip }) => {
                  const f = report.fundUtilization[key];
                  return (
                    <div key={key} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm print:shadow-none print:border-slate-300">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">{icon}{title}</h4>
                        <span className={`text-xs px-2.5 py-1 rounded-full border ${chip}`}>
                          {key === 'restricted' ? 'Donor-restricted' : 'General purpose'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Received</p>
                          <p className="font-semibold text-slate-900 tabular-nums">{numberFmt(f.received)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Spent</p>
                          <p className="font-semibold text-slate-900 tabular-nums">{numberFmt(f.spent)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Balance</p>
                          <p className={`font-bold tabular-nums ${f.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>{numberFmt(f.balance)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cashflow table (print-friendly detail) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm print:shadow-none print:border-slate-300">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Cashflow Detail</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2 font-medium">Month</th>
                      <th className="py-2 font-medium text-right">Received</th>
                      <th className="py-2 font-medium text-right">Spent</th>
                      <th className="py-2 font-medium text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.cashflow.map((row) => (
                      <tr key={`${row.year}-${row.month}`} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 text-slate-700">{monthLabel(row)}</td>
                        <td className="py-2 text-right text-slate-900 tabular-nums">{numberFmt(row.received)}</td>
                        <td className="py-2 text-right text-slate-900 tabular-nums">{numberFmt(row.spent)}</td>
                        <td className={`py-2 text-right font-medium tabular-nums ${row.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{numberFmt(row.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
