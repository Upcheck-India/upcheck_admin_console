'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import UnauthorizedAccess from '../../../components/UnauthorizedAccess';
import useBillingAccount from '../funds/_hooks/useBillingAccount';
import AccountSelector from '../funds/_components/AccountSelector';
import { numberFmt, EXPENSE_TYPES } from '../funds/_components/constants';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';

// Idempotency key for a payment intent. Generated when the pay modal OPENS so a
// double-click / retry of the same submit is replayed by the server, not paid twice.
const genOpId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + '-' + Math.random().toString(36).slice(2));

// Static class maps — never build tailwind classes from template strings.
const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
};
const STATUS_LABELS = { draft: 'Draft', approved: 'Approved', paid: 'Paid', cancelled: 'Cancelled' };

const INITIAL_VENDOR_FORM = {
  name: '', contactPerson: '', email: '', phone: '', gstin: '', pan: '',
  category: '', address: '', notes: '', tagsText: '',
};
const INITIAL_BILL_FORM = {
  vendorId: '', billNumber: '', description: '', amount: '',
  billDate: '', dueDate: '', expenseType: '',
};

function StatusChip({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' }) : '—');
const todayStr = () => new Date().toISOString().split('T')[0];
const isOverdue = (bill) => bill.status === 'approved' && bill.dueDate && new Date(bill.dueDate) < new Date();

export default function VendorsPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');

  const { accounts, activeAccountId, selectAccount, addAccount } = useBillingAccount();

  const [tab, setTab] = useState('vendors');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // ---- Vendors ----
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [vendorForm, setVendorForm] = useState(INITIAL_VENDOR_FORM);
  const [deletingVendorId, setDeletingVendorId] = useState(null);

  // ---- Bills ----
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billSummary, setBillSummary] = useState(null);
  const [billStatusFilter, setBillStatusFilter] = useState('');
  const [billVendorFilter, setBillVendorFilter] = useState('');
  const [showBillModal, setShowBillModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [billForm, setBillForm] = useState(INITIAL_BILL_FORM);
  const [deletingBillId, setDeletingBillId] = useState(null);
  const [actingBillId, setActingBillId] = useState(null);

  // ---- Pay modal ----
  const [payModal, setPayModal] = useState(null); // { bill, opId, date, notes }

  const loadVendors = useCallback(async () => {
    try {
      setVendorsLoading(true);
      const params = new URLSearchParams({ limit: '500' });
      if (vendorSearch) params.append('search', vendorSearch);
      const res = await fetch(`/api/organization/vendors?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load vendors');
      const data = await res.json();
      setVendors(data.items || []);
    } catch (e) {
      setError(e.message || 'Failed to load vendors');
    } finally {
      setVendorsLoading(false);
    }
  }, [vendorSearch]);

  const loadBills = useCallback(async () => {
    if (!activeAccountId) {
      setBills([]);
      setBillSummary(null);
      return;
    }
    try {
      setBillsLoading(true);
      const params = new URLSearchParams({ accountId: activeAccountId, limit: '500' });
      if (billStatusFilter) params.append('status', billStatusFilter);
      if (billVendorFilter) params.append('vendorId', billVendorFilter);
      const res = await fetch(`/api/organization/vendor-bills?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load bills');
      const data = await res.json();
      setBills(data.items || []);
      setBillSummary(data.summary || null);
    } catch (e) {
      setError(e.message || 'Failed to load bills');
    } finally {
      setBillsLoading(false);
    }
  }, [activeAccountId, billStatusFilter, billVendorFilter]);

  useEffect(() => { if (isAdmin) loadVendors(); }, [isAdmin, loadVendors]);
  useEffect(() => { if (isAdmin) loadBills(); }, [isAdmin, loadBills]);

  // ---- Vendor actions ----
  const openNewVendor = () => {
    setEditingVendor(null);
    setVendorForm(INITIAL_VENDOR_FORM);
    setShowVendorModal(true);
  };

  const openEditVendor = (v) => {
    setEditingVendor(v);
    setVendorForm({
      name: v.name || '', contactPerson: v.contactPerson || '', email: v.email || '',
      phone: v.phone || '', gstin: v.gstin || '', pan: v.pan || '',
      category: v.category || '', address: v.address || '', notes: v.notes || '',
      tagsText: Array.isArray(v.tags) ? v.tags.join(', ') : '',
    });
    setShowVendorModal(true);
  };

  const submitVendor = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const body = {
        ...vendorForm,
        tags: (vendorForm.tagsText || '').split(',').map((t) => t.trim()).filter(Boolean),
      };
      delete body.tagsText;
      const url = editingVendor
        ? `/api/organization/vendors/${editingVendor._id}`
        : '/api/organization/vendors';
      const res = await fetch(url, {
        method: editingVendor ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save vendor');
      }
      setShowVendorModal(false);
      setEditingVendor(null);
      await loadVendors();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteVendor = async (v) => {
    if (!confirm(`Delete vendor "${v.name}"? Historical bills stay linked for auditing.`)) return;
    try {
      setDeletingVendorId(v._id);
      const res = await fetch(`/api/organization/vendors/${v._id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to delete vendor');
      }
      await loadVendors();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setDeletingVendorId(null);
    }
  };

  // ---- Bill actions ----
  const openNewBill = (vendorId = '') => {
    setEditingBill(null);
    setBillForm({ ...INITIAL_BILL_FORM, vendorId: vendorId || '', billDate: todayStr() });
    setShowBillModal(true);
    setTab('bills');
  };

  const openEditBill = (b) => {
    setEditingBill(b);
    setBillForm({
      vendorId: b.vendorId || '',
      billNumber: b.billNumber || '',
      description: b.description || '',
      amount: String(b.amount ?? ''),
      billDate: b.billDate ? new Date(b.billDate).toISOString().split('T')[0] : '',
      dueDate: b.dueDate ? new Date(b.dueDate).toISOString().split('T')[0] : '',
      expenseType: b.expenseType || '',
    });
    setShowBillModal(true);
  };

  const submitBill = async (e) => {
    e.preventDefault();
    if (!activeAccountId && !editingBill) {
      setError('Select a billing account before creating bills');
      return;
    }
    setIsSaving(true);
    try {
      const body = {
        ...billForm,
        amount: Number(billForm.amount),
        ...(editingBill ? {} : { accountId: activeAccountId }),
      };
      const url = editingBill
        ? `/api/organization/vendor-bills/${editingBill._id}`
        : '/api/organization/vendor-bills';
      const res = await fetch(url, {
        method: editingBill ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save bill');
      }
      setShowBillModal(false);
      setEditingBill(null);
      await Promise.all([loadBills(), loadVendors()]);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setIsSaving(false);
    }
  };

  const setBillStatus = async (bill, status, confirmMsg) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    try {
      setActingBillId(bill._id);
      const res = await fetch(`/api/organization/vendor-bills/${bill._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update bill');
      }
      await Promise.all([loadBills(), loadVendors()]);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setActingBillId(null);
    }
  };

  const deleteBill = async (bill) => {
    if (!confirm(`Delete bill ${bill.billNumber || ''} for ${numberFmt(bill.amount)}?`)) return;
    try {
      setDeletingBillId(bill._id);
      const res = await fetch(`/api/organization/vendor-bills/${bill._id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to delete bill');
      }
      await Promise.all([loadBills(), loadVendors()]);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setDeletingBillId(null);
    }
  };

  // opId is minted here, when the modal opens — a stable key for this intent.
  const openPay = (bill) => {
    setPayModal({ bill, opId: genOpId(), date: todayStr(), notes: '' });
  };

  const submitPay = async (e) => {
    e.preventDefault();
    if (!payModal) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/organization/vendor-bills/${payModal.bill._id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ opId: payModal.opId, date: payModal.date, notes: payModal.notes }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to pay bill');
      }
      setPayModal(null);
      await Promise.all([loadBills(), loadVendors()]);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="h-14 w-14 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="absolute inset-0 h-14 w-14 border-3 border-indigo-200 rounded-full animate-pulse" />
          </div>
          <p className="mt-6 text-slate-600 font-medium">Loading vendors &amp; payables...</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) return <UnauthorizedAccess />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/organization/finance" className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl" title="Back">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-2 rounded-xl shadow-lg">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">Vendors &amp; Payables</span>
                  <div className="h-0.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full mt-0.5" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AccountSelector
                accounts={accounts}
                activeAccountId={activeAccountId || ''}
                onSelect={(id) => selectAccount(id)}
                onAdd={(name) => addAccount(name)}
              />
              <Link href="/organization/finance/accounts" className="px-2 py-1.5 text-xs rounded-lg border bg-white hover:bg-slate-50 text-slate-700">Manage</Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button className="hover:bg-red-100 rounded-lg p-1" onClick={() => setError(null)} aria-label="Dismiss error">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* AP summary cards (account-scoped) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-sm text-slate-600"><Wallet className="w-4 h-4 text-blue-600" /> Outstanding (approved)</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{numberFmt(billSummary?.totalOutstanding || 0)}</div>
            <div className="text-xs text-slate-500 mt-0.5">{billSummary?.outstandingCount || 0} bill(s) awaiting payment</div>
          </div>
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
            <div className="flex items-center gap-2 text-sm text-amber-700"><Clock className="w-4 h-4" /> Overdue</div>
            <div className="text-2xl font-bold text-amber-900 mt-1">{numberFmt(billSummary?.totalOverdue || 0)}</div>
            <div className="text-xs text-amber-700 mt-0.5">{billSummary?.overdueCount || 0} bill(s) past due date</div>
          </div>
          <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4">
            <div className="flex items-center gap-2 text-sm text-emerald-700"><Banknote className="w-4 h-4" /> Paid this month</div>
            <div className="text-2xl font-bold text-emerald-900 mt-1">{numberFmt(billSummary?.paidThisMonth || 0)}</div>
            <div className="text-xs text-emerald-700 mt-0.5">{billSummary?.paidThisMonthCount || 0} payment(s)</div>
          </div>
        </div>

        {!activeAccountId && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 text-amber-800 flex items-center gap-3 border border-amber-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">No billing account selected. Select or create an account to view and record vendor bills.</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200 overflow-x-auto">
          {[
            { key: 'vendors', label: 'Vendors', icon: <Building2 className="w-4 h-4" /> },
            { key: 'bills', label: 'Bills', icon: <FileText className="w-4 h-4" /> },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'border-violet-600 text-violet-700 font-medium'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ===================== VENDORS TAB ===================== */}
        {tab === 'vendors' && (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    className="pl-10 pr-3 py-2 border rounded-xl"
                    placeholder="Search name, contact, GSTIN..."
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                  />
                </div>
                <button onClick={loadVendors} className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 ${vendorsLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
              <button onClick={openNewVendor} className="px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Vendor
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {vendorsLoading ? (
                <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading vendors...
                </div>
              ) : vendors.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Building2 className="w-7 h-7 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">No vendors yet</h3>
                  <p className="text-slate-500 text-sm mb-4">Add your first vendor to start tracking payables.</p>
                  <button onClick={openNewVendor} className="px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Vendor
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Vendor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Contact</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">GSTIN / PAN</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Outstanding</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vendors.map((v) => (
                        <tr key={v._id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{v.name}</div>
                            {Array.isArray(v.tags) && v.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {v.tags.slice(0, 4).map((t) => (
                                  <span key={t} className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 text-slate-600">{t}</span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            <div>{v.contactPerson || '—'}</div>
                            <div className="text-xs text-slate-500">{v.email || v.phone || ''}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 capitalize">{v.category || '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                            <div>{v.gstin || '—'}</div>
                            <div>{v.pan || ''}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {v.outstandingCount > 0 ? (
                              <>
                                <div className="font-semibold text-blue-700">{numberFmt(v.outstanding || 0)}</div>
                                <div className="text-xs text-slate-500">{v.outstandingCount} open bill(s)</div>
                              </>
                            ) : (
                              <span className="text-slate-400 text-sm">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openNewBill(String(v._id))}
                                disabled={!activeAccountId}
                                className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
                                title={activeAccountId ? 'Record a bill from this vendor' : 'Select a billing account first'}
                              >
                                <FileText className="w-4 h-4" /> New Bill
                              </button>
                              <button onClick={() => openEditVendor(v)} className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
                                <Pencil className="w-4 h-4" /> Edit
                              </button>
                              <button
                                onClick={() => deleteVendor(v)}
                                disabled={deletingVendorId === v._id}
                                className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1.5 disabled:opacity-50"
                              >
                                {deletingVendorId === v._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===================== BILLS TAB ===================== */}
        {tab === 'bills' && (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="border rounded-xl px-3 py-2 text-sm bg-white"
                  value={billStatusFilter}
                  onChange={(e) => setBillStatusFilter(e.target.value)}
                  title="Filter by status"
                >
                  <option value="">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select
                  className="border rounded-xl px-3 py-2 text-sm bg-white max-w-[220px]"
                  value={billVendorFilter}
                  onChange={(e) => setBillVendorFilter(e.target.value)}
                  title="Filter by vendor"
                >
                  <option value="">All vendors</option>
                  {vendors.map((v) => (
                    <option key={v._id} value={String(v._id)}>{v.name}</option>
                  ))}
                </select>
                <button onClick={loadBills} disabled={!activeAccountId} className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${billsLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
              <button
                onClick={() => openNewBill()}
                disabled={!activeAccountId || vendors.length === 0}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={vendors.length === 0 ? 'Add a vendor first' : 'Record a new bill'}
              >
                <Plus className="w-4 h-4" /> New Bill
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {!activeAccountId ? (
                <div className="p-12 text-center text-slate-500">Select a billing account to view its bills.</div>
              ) : billsLoading ? (
                <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading bills...
                </div>
              ) : bills.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-7 h-7 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">No bills found</h3>
                  <p className="text-slate-500 text-sm mb-4">
                    {billStatusFilter || billVendorFilter ? 'Try clearing the filters.' : 'Record your first vendor bill to start tracking payables.'}
                  </p>
                  {!billStatusFilter && !billVendorFilter && vendors.length > 0 && (
                    <button onClick={() => openNewBill()} className="px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 inline-flex items-center gap-2">
                      <Plus className="w-4 h-4" /> New Bill
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Bill</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Vendor</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Bill Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Due</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bills.map((b) => (
                        <tr key={b._id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{b.billNumber || '(no number)'}</div>
                            {b.description && <div className="text-xs text-slate-500 max-w-[260px] truncate">{b.description}</div>}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{b.vendorName || '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">{numberFmt(b.amount)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{fmtDate(b.billDate)}</td>
                          <td className={`px-4 py-3 text-sm ${isOverdue(b) ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                            {fmtDate(b.dueDate)}
                            {isOverdue(b) && <span className="block text-[10px] uppercase tracking-wide">Overdue</span>}
                          </td>
                          <td className="px-4 py-3"><StatusChip status={b.status} /></td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {b.status === 'draft' && (
                                <>
                                  <button
                                    onClick={() => setBillStatus(b, 'approved')}
                                    disabled={actingBillId === b._id}
                                    className="px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    {actingBillId === b._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve
                                  </button>
                                  <button onClick={() => openEditBill(b)} className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
                                    <Pencil className="w-4 h-4" /> Edit
                                  </button>
                                </>
                              )}
                              {b.status === 'approved' && (
                                <>
                                  <button
                                    onClick={() => openPay(b)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5"
                                  >
                                    <Banknote className="w-4 h-4" /> Pay
                                  </button>
                                  <button
                                    onClick={() => setBillStatus(b, 'cancelled', 'Cancel this approved bill? It will no longer count as outstanding.')}
                                    disabled={actingBillId === b._id}
                                    className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    {actingBillId === b._id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancel'}
                                  </button>
                                </>
                              )}
                              {b.status !== 'paid' && (
                                <button
                                  onClick={() => deleteBill(b)}
                                  disabled={deletingBillId === b._id}
                                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {deletingBillId === b._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                              )}
                              {b.status === 'paid' && (
                                <span className="text-xs text-slate-500">Paid {b.paidAt ? fmtDate(b.paidAt) : ''}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-4 p-3 rounded-xl bg-blue-50 text-blue-700 text-sm border border-blue-200">
              <strong>Note:</strong> Paying a bill posts a matching outflow entry to the Funds ledger of the bill&apos;s billing account (tagged <span className="font-semibold">ap</span>). Paid bills are locked and cannot be edited or deleted.
            </div>
          </>
        )}
      </div>

      {/* ===================== VENDOR MODAL ===================== */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b font-semibold flex items-center justify-between">
              <span>{editingVendor ? 'Edit Vendor' : 'Add Vendor'}</span>
              <button className="p-1 rounded-lg hover:bg-slate-100" onClick={() => setShowVendorModal(false)} aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={submitVendor} className="p-4 space-y-3 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input required className="w-full border rounded-xl px-3 py-2" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} placeholder="e.g., Acme Supplies Pvt Ltd" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Person</label>
                  <input className="w-full border rounded-xl px-3 py-2" value={vendorForm.contactPerson} onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <input className="w-full border rounded-xl px-3 py-2" value={vendorForm.category} onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })} placeholder="e.g., software, printing" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input type="email" className="w-full border rounded-xl px-3 py-2" value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input className="w-full border rounded-xl px-3 py-2" value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">GSTIN</label>
                  <input className="w-full border rounded-xl px-3 py-2 font-mono uppercase" maxLength={15} value={vendorForm.gstin} onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value.toUpperCase() })} placeholder="15 characters" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">PAN</label>
                  <input className="w-full border rounded-xl px-3 py-2 font-mono uppercase" maxLength={10} value={vendorForm.pan} onChange={(e) => setVendorForm({ ...vendorForm, pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <textarea rows={2} className="w-full border rounded-xl px-3 py-2" value={vendorForm.address} onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
                  <input className="w-full border rounded-xl px-3 py-2" value={vendorForm.tagsText} onChange={(e) => setVendorForm({ ...vendorForm, tagsText: e.target.value })} placeholder="critical, annual-contract" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <input className="w-full border rounded-xl px-3 py-2" value={vendorForm.notes} onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="px-4 py-2 rounded-lg border" onClick={() => setShowVendorModal(false)}>Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} {isSaving ? 'Saving...' : editingVendor ? 'Save Changes' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== BILL MODAL ===================== */}
      {showBillModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-4 border-b font-semibold flex items-center justify-between">
              <span>{editingBill ? 'Edit Bill' : 'New Vendor Bill'}</span>
              <button className="p-1 rounded-lg hover:bg-slate-100" onClick={() => setShowBillModal(false)} aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={submitBill} className="p-4 space-y-3 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium mb-1">Vendor *</label>
                <select
                  required
                  disabled={!!editingBill}
                  className="w-full border rounded-xl px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500"
                  value={billForm.vendorId}
                  onChange={(e) => setBillForm({ ...billForm, vendorId: e.target.value })}
                >
                  <option value="">Select vendor</option>
                  {vendors.map((v) => (
                    <option key={v._id} value={String(v._id)}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Bill Number</label>
                  <input className="w-full border rounded-xl px-3 py-2" value={billForm.billNumber} onChange={(e) => setBillForm({ ...billForm, billNumber: e.target.value })} placeholder="INV-2026-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Amount (₹) *</label>
                  <input required type="number" min="0.01" step="0.01" className="w-full border rounded-xl px-3 py-2" value={billForm.amount} onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Bill Date</label>
                  <input type="date" className="w-full border rounded-xl px-3 py-2" value={billForm.billDate} onChange={(e) => setBillForm({ ...billForm, billDate: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Due Date</label>
                  <input type="date" className="w-full border rounded-xl px-3 py-2" value={billForm.dueDate} onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expense Type</label>
                <select className="w-full border rounded-xl px-3 py-2" value={billForm.expenseType} onChange={(e) => setBillForm({ ...billForm, expenseType: e.target.value })}>
                  <option value="">Select type</option>
                  {EXPENSE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea rows={2} className="w-full border rounded-xl px-3 py-2" value={billForm.description} onChange={(e) => setBillForm({ ...billForm, description: e.target.value })} placeholder="What is this bill for?" />
              </div>
              {!editingBill && (
                <p className="text-xs text-slate-500">The bill is created as a <span className="font-semibold">draft</span> on the selected billing account. Approve it to make it payable.</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="px-4 py-2 rounded-lg border" onClick={() => setShowBillModal(false)}>Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} {isSaving ? 'Saving...' : editingBill ? 'Save Changes' : 'Create Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== PAY MODAL ===================== */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-4 border-b font-semibold flex items-center justify-between">
              <span>Pay Bill</span>
              <button className="p-1 rounded-lg hover:bg-slate-100" onClick={() => setPayModal(null)} aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={submitPay} className="p-4 space-y-3">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200">
                <div className="text-sm text-emerald-700">Paying {payModal.bill.vendorName || 'vendor'}{payModal.bill.billNumber ? ` — ${payModal.bill.billNumber}` : ''}</div>
                <div className="text-2xl font-bold text-emerald-900 mt-1">{numberFmt(payModal.bill.amount)}</div>
                <div className="text-xs text-emerald-700 mt-1">An outflow entry will be posted to the Funds ledger of this bill&apos;s account.</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Date</label>
                  <input type="date" className="w-full border rounded-xl px-3 py-2" value={payModal.date} onChange={(e) => setPayModal({ ...payModal, date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <input className="w-full border rounded-xl px-3 py-2" value={payModal.notes} onChange={(e) => setPayModal({ ...payModal, notes: e.target.value })} placeholder="UTR / reference" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="px-4 py-2 rounded-lg border" onClick={() => setPayModal(null)}>Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} {isSaving ? 'Paying...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
