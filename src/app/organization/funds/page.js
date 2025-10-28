'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import UnauthorizedAccess from '../../../components/UnauthorizedAccess';
import useOnlineUsers from '../../../hooks/useOnlineUsers';
import { 
  Filter, 
  FileDown, 
  PieChart as PieIcon, 
  BarChart3, 
  ChevronDown, 
  AlertCircle, 
  X, 
  Loader2, 
  Plus,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download
} from 'lucide-react';

import OrgNavbar from './_components/Navbar';
import FiltersPanel from './_components/FiltersPanel';
import SummaryCards from './_components/SummaryCards';
import MonthlyTrendsChart from './_components/MonthlyTrendsChart';
import CategoryPie from './_components/CategoryPie';
import InflowOutflowDonut from './_components/InflowOutflowDonut';
import TypeBreakdowns from './_components/TypeBreakdowns';
import QuickStats from './_components/QuickStats';
import CashflowSparkline from './_components/CashflowSparkline';
import TopLists from './_components/TopLists';
import TransactionsTable from './_components/TransactionsTable';
import EntryModal from './_components/EntryModal';
import ExportModal from './_components/ExportModal';
import { CATEGORIES } from './_components/constants';
import useFundsData from './_hooks/useFundsData';
import DetailsDrawer from './_components/DetailsDrawer';
import useBillingAccount from './_hooks/useBillingAccount';
import AccountSelector from './_components/AccountSelector';

const INITIAL_FORM = {
  kind: 'in',
  amount: '',
  title: '',
  date: '',
  notes: '',
  source: '',
  counterparty: '',
  reference: '',
  tagsText: '',
  inflowType: '',
  expenseType: '',
  fundRestriction: 'unrestricted',
  allocations: []
};

export default function OrgFundsPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');
  const onlineUsers = useOnlineUsers();

  const [username, setUsername] = useState('');

  const {
    loading,
    error,
    setError,
    items,
    summary,
    filters,
    setFilters,
    load,
    saveEntry,
    deleteEntry,
    exportCSV,
    chartData,
    pieData,
    inflowPieData,
    outflowPieData,
    runway,
    numberFmt,
  } = useFundsData();

  const { accounts, activeAccount, activeAccountId, addAccount, selectAccount } = useBillingAccount();

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);

  const [showFilters, setShowFilters] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [untransferredSummary, setUntransferredSummary] = useState(null);
  const [showExport, setShowExport] = useState(false);

  // Load username from localStorage
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) setUsername(storedUsername);
  }, []);

  // Load untransferred funds summary
  useEffect(() => {
    if (!isAdmin) return;
    const loadUntransferred = async () => {
      try {
        const res = await fetch('/api/organization/untransferred', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setUntransferredSummary(data.summary);
      } catch (e) {
        console.error('Failed to load untransferred summary', e);
      }
    };
    loadUntransferred();
  }, [isAdmin]);

  // Sync account filter when authenticated; actual loading is handled by useFundsData effect
  useEffect(() => {
    if (!authLoading && isAdmin) {
      if (activeAccountId && filters.accountId !== activeAccountId) {
        setFilters((f) => ({ ...f, accountId: activeAccountId }));
      }
    }
  }, [authLoading, isAdmin, activeAccountId, setFilters, filters.accountId]);

  // Memoize handlers to prevent unnecessary re-renders
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

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    const payload = {
      ...form,
      amount: Number(form.amount),
      date: form.date || new Date().toISOString().split('T')[0],
      accountId: activeAccountId || null,
      tags: (form.tagsText || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    try {
      await saveEntry(payload, editingItem?._id);
      setShowForm(false);
      setEditingItem(null);
      setForm(INITIAL_FORM);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  }, [form, editingItem, saveEntry, setError, activeAccountId]);

  const handleEdit = useCallback((item) => {
    setEditingItem(item);
    setForm({
      kind: item.kind,
      amount: String(item.amount || ''),
      title: item.title || '',
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      notes: item.notes || '',
      inflowType: item.inflowType || (item.kind === 'in' ? (item.category || '') : ''),
      expenseType: item.expenseType || (item.kind === 'out' ? (item.category || '') : ''),
      source: item.source || '',
      counterparty: item.counterparty || '',
      reference: item.reference || '',
      tagsText: Array.isArray(item.tags) ? item.tags.join(',') : '',
      fundRestriction: item.fundRestriction || 'unrestricted',
      allocations: Array.isArray(item.allocations) ? item.allocations : [],
    });
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!confirm('Delete this entry? This action cannot be undone.')) return;
    
    setIsDeleting(id);
    try {
      await deleteEntry(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsDeleting(null);
    }
  }, [deleteEntry, setError]);

  const handleAddNew = useCallback(() => {
    setEditingItem(null);
    setForm(INITIAL_FORM);
    setShowForm(true);
  }, []);

  const handleViewDetails = useCallback((item) => {
    setViewItem(item);
    setDetailsOpen(true);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      category: '',
      kind: '',
      startDate: '',
      endDate: '',
      datePreset: 'thisYear',
      groupBy: 'month'
    });
    load();
  }, [setFilters, load]);

  const handleRefresh = useCallback(() => {
    if (activeAccountId) load();
  }, [load, activeAccountId]);

  // Memoize computed values
  const sortedCategoryData = useMemo(() => {
    return pieData.slice().sort((a, b) => b.value - a.value);
  }, [pieData]);

  const hasData = items.length > 0;
  const noAccount = !activeAccountId;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Cmd/Ctrl + K to open filters
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowFilters(prev => !prev);
      }
      // Cmd/Ctrl + N to add new entry
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleAddNew();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleAddNew]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <OrgNavbar
        title="Funds & Runway"
        backHref="/organization/finance"
        onlineUsers={onlineUsers}
        user={user}
        username={username}
        onLogout={handleLogout}
      />

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-sm text-slate-600 mb-6" aria-label="Breadcrumb">
          <Link href="/console" className="hover:text-indigo-600 transition-colors">
            Console
          </Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <Link href="/organization" className="hover:text-indigo-600 transition-colors">
            Organization
          </Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <Link href="/organization/finance" className="hover:text-indigo-600 transition-colors">
            Finance
          </Link>
          <ChevronDown className="w-4 h-4 -rotate-90" />
          <span className="text-slate-900 font-medium">Funds</span>
        </nav>

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div className="h-8 w-1 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                Funds & Runway
              </h1>
              {!!activeAccount && (
                <span className="inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Account: <span className="font-semibold">{activeAccount.name}</span>
                </span>
              )}
            </div>
            <p className="text-slate-600 ml-3">
              Financial tracking and runway management
              {hasData && (
                <span className="ml-2 text-slate-500">
                  • {items.length} transaction{items.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap items-center">
            <AccountSelector
              accounts={accounts}
              activeAccountId={activeAccountId || ''}
              onSelect={(id) => {
                selectAccount(id);
                setFilters((f) => ({ ...f, accountId: id || '' }));
              }}
              onAdd={(name) => {
                const acc = addAccount(name);
                setFilters((f) => ({ ...f, accountId: acc.id }));
              }}
            />
            <button
              onClick={handleRefresh}
              disabled={loading || noAccount}
              className="px-4 py-2 rounded-xl bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 transition-all"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              disabled={noAccount}
              className={`px-4 py-2 rounded-xl border-2 transition-all ${
                showFilters
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
              } flex items-center gap-2 disabled:opacity-50`}
              title="Toggle filters (⌘K)"
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
            
            <button
              onClick={() => setShowExport(true)}
              disabled={!hasData || noAccount}
              className="px-4 py-2 rounded-xl bg-white border-2 border-slate-200 text-slate-700 hover:border-green-300 hover:bg-green-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title="Export data"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            
            <button
              onClick={handleAddNew}
              disabled={noAccount}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Add new entry (⌘N)"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Entry</span>
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 flex items-center gap-3 border border-red-200 animate-in slide-in-from-top">
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
        {!activeAccountId && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 text-amber-800 flex items-center gap-3 border border-amber-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">No billing account selected. Add/select an account to scope entries and analytics across modules.</span>
          </div>
        )}

        {noAccount && (
          <div className="mb-8 bg-white rounded-2xl border-2 border-dashed border-slate-300 p-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Set up a billing account</h3>
              <p className="text-slate-600">Create or select an account to enable Funds, Budgets, and Expenses modules.</p>
            </div>
            <Link href="/organization/finance/accounts" className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">Go to Accounts</Link>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="animate-in slide-in-from-top duration-200">
            <FiltersPanel
              filters={filters}
              setFilters={setFilters}
              onApply={load}
              onClear={handleClearFilters}
              disabled={noAccount}
            />
          </div>
        )}

        {/* View Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200 overflow-x-auto">
          {[
            { key: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
            { key: 'table', label: 'Transactions', icon: <Download className="w-4 h-4" /> },
            { key: 'analytics', label: 'Analytics', icon: <PieIcon className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              className={`px-4 py-2 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                activeView === tab.key
                  ? 'border-indigo-600 text-indigo-700 font-medium'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {loading && !hasData ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
            <p className="text-slate-600">Loading financial data...</p>
          </div>
        ) : !hasData && !loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-300">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No transactions yet</h3>
            <p className="text-slate-600 mb-6">Get started by adding your first financial entry</p>
            <button
              onClick={handleAddNew}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-5 h-5" />
              Add First Entry
            </button>
          </div>
        ) : (
          <>
            {/* Dashboard View */}
            {activeView === 'dashboard' && (
              <div className="animate-in fade-in duration-300">
                <SummaryCards summary={summary} runway={runway} numberFmt={numberFmt} untransferredSummary={untransferredSummary} />
                <QuickStats items={items} monthlyTrends={chartData} numberFmt={numberFmt} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <MonthlyTrendsChart data={chartData} numberFmt={numberFmt} groupBy={filters.groupBy} />
                  <InflowOutflowDonut summary={summary} numberFmt={numberFmt} />
                </div>
                <CashflowSparkline data={chartData} numberFmt={numberFmt} />
                <TypeBreakdowns inflowPieData={inflowPieData} outflowPieData={outflowPieData} items={items} numberFmt={numberFmt} />
                <TopLists items={items} numberFmt={numberFmt} />
              </div>
            )}

            {/* Table View */}
            {activeView === 'table' && (
              <div className="animate-in fade-in duration-300">
                <TransactionsTable
                  items={items}
                  numberFmt={numberFmt}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onView={handleViewDetails}
                  isDeleting={isDeleting}
                />
              </div>
            )}

            {/* Analytics View */}
            {activeView === 'analytics' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <PieIcon className="w-5 h-5 text-indigo-600" />
                    Category Breakdown
                  </h3>
                  {sortedCategoryData.length > 0 ? (
                    <ul className="divide-y divide-slate-100">
                      {sortedCategoryData.map((row) => {
                        const category = CATEGORIES.find((c) => c.value === row.name);
                        const total = pieData.reduce((sum, item) => sum + item.value, 0);
                        const percentage = total > 0 ? ((row.value / total) * 100).toFixed(1) : '0.0';
                        
                        return (
                          <li key={row.name} className="py-3 flex items-center justify-between hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors">
                            <div className="flex items-center gap-3">
                              <span
                                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: category?.color || '#6b7280' }}
                              />
                              <div>
                                <span className="text-slate-800 font-medium capitalize block">
                                  {row.name}
                                </span>
                                <span className="text-xs text-slate-500">{percentage}% of total</span>
                              </div>
                            </div>
                            <span className="text-slate-900 font-semibold">{numberFmt(row.value)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-slate-500 text-center py-8">No category data available</p>
                  )}
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-indigo-600" />
                    Runway Analysis
                  </h3>
                  <p className="text-slate-600 mb-6">
                    Estimated months based on average spending from the last 3 months
                  </p>
                  {runway ? (
                    <>
                      <div className="text-5xl font-bold text-slate-900 mb-4">
                        {runway} <span className="text-2xl text-slate-600">months</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {runway > 12 ? (
                          <>
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="text-green-700 font-medium">Healthy runway</span>
                          </>
                        ) : runway > 6 ? (
                          <>
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <span className="text-amber-700 font-medium">Monitor closely</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-4 h-4 text-red-600" />
                            <span className="text-red-700 font-medium">Action needed</span>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-500 py-8 text-center">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p>Not enough data to calculate runway</p>
                      <p className="text-sm mt-1">Add more transactions to see insights</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {showExport && (
          <ExportModal
            onClose={() => setShowExport(false)}
            items={items}
            numberFmt={numberFmt}
            defaultFilename={`funds-${new Date().toISOString().split('T')[0]}`}
          />
        )}
      </div>

      {/* Entry Modal */}
      <EntryModal
        open={showForm}
        editingItem={editingItem}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        onClose={() => {
          setShowForm(false);
          setEditingItem(null);
          setForm(INITIAL_FORM);
        }}
        isSaving={isSaving}
      />

      {/* Details Drawer */}
      <DetailsDrawer
        open={detailsOpen}
        item={viewItem}
        onClose={() => {
          setDetailsOpen(false);
          setViewItem(null);
        }}
      />
    </div>
  );
}