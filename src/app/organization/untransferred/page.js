'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import UnauthorizedAccess from '../../../components/UnauthorizedAccess';
import { AlertCircle, ArrowLeft, ArrowRightLeft, Download, Loader2, Plus, RefreshCw, Search, Wallet, Trash2 } from 'lucide-react';
import useBillingAccount from '../funds/_hooks/useBillingAccount';
import AccountSelector from '../funds/_components/AccountSelector';

export default function UntransferredPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');

  const { accounts, activeAccountId, selectAccount, addAccount } = useBillingAccount();

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, remaining: 0 });
  const [accountBalances, setAccountBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsItem, setDetailsItem] = useState(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [transferForm, setTransferForm] = useState({ accountId: '', amount: '', date: '', notes: '', inflowType: 'grant' });
  const [receiveForm, setReceiveForm] = useState({ accountId: '', amount: '', title: '', date: '', notes: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (searchText) params.append('search', searchText);
      const res = await fetch(`/api/organization/untransferred?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load untransferred funds');
      const data = await res.json();
      setItems(data.items || []);
      setSummary(data.summary || { total: 0, remaining: 0 });
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  const loadAccountBalances = useCallback(async () => {
    if (accounts.length === 0) return;
    try {
      const balances = await Promise.all(
        accounts.map(async (acc) => {
          try {
            const res = await fetch(`/api/organization/funds?accountId=${acc.id}&excludeTransfers=true`, { credentials: 'include' });
            if (!res.ok) return { accountId: acc.id, accountName: acc.name, balance: 0 };
            const data = await res.json();
            return { accountId: acc.id, accountName: acc.name, balance: data.summary?.balance || 0 };
          } catch {
            return { accountId: acc.id, accountName: acc.name, balance: 0 };
          }
        })
      );
      setAccountBalances(balances);
    } catch (e) {
      console.error('Failed to load account balances', e);
    }
  }, [accounts]);

  useEffect(() => { load(); loadAccountBalances(); }, [load, loadAccountBalances]);

  // Toggle: show cleanup button (set to true to reveal for admins)
  const SHOW_CLEANUP_BUTTON = true;

  const runCleanup = useCallback(async () => {
    try {
      setCleanupLoading(true);
      const res = await fetch('/api/organization/untransferred/cleanup', { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Cleanup failed');
      }
      await load();
    } catch (e) {
      setError(e.message || 'Cleanup failed');
    } finally {
      setCleanupLoading(false);
    }
  }, [load]);

  const openTransfer = (item) => {
    setSelectedItem(item);
    const baseAmt = (item.remainingAmount ?? item.amount);
    setTransferForm({ accountId: activeAccountId || '', amount: String(baseAmt != null ? baseAmt : ''), date: new Date().toISOString().split('T')[0], notes: '', inflowType: 'grant' });
    setShowTransferModal(true);
  };

  const removeItem = useCallback(async (id) => {
    if (!id) return;
    if (!confirm('Remove this untransferred entry? This cannot be undone.')) return;
    try {
      setDeletingId(id);
      const res = await fetch(`/api/organization/untransferred/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to delete');
      }
      await load();
    } catch (e) {
      setError(e.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }, [load]);

  const submitTransfer = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsSaving(true);
    try {
      const body = { ...transferForm, amount: Number(transferForm.amount) };
      const res = await fetch(`/api/organization/untransferred/${selectedItem._id}/transfer-to-account`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to transfer');
      }
      setShowTransferModal(false);
      await load();
    } catch (e) { setError(e.message); } finally { setIsSaving(false); }
  };

  const openReceive = () => {
    setReceiveForm({ accountId: activeAccountId || '', amount: '', title: '', date: new Date().toISOString().split('T')[0], notes: '' });
    setShowReceiveModal(true);
  };

  const submitReceive = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const body = { ...receiveForm, amount: Number(receiveForm.amount) };
      const res = await fetch('/api/organization/untransferred/receive-from-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to receive');
      }
      setShowReceiveModal(false);
      await load();
    } catch (e) { setError(e.message); } finally { setIsSaving(false); }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="h-14 w-14 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="absolute inset-0 h-14 w-14 border-3 border-indigo-200 rounded-full animate-pulse" />
          </div>
          <p className="mt-6 text-slate-600 font-medium">Loading untransferred funds...</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) return <UnauthorizedAccess />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/organization/finance" className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl" title="Back">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-green-600 p-2 rounded-xl shadow-lg">
                  <Wallet className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 bg-clip-text text-transparent">Untransferred Funds</span>
                  <div className="h-0.5 bg-gradient-to-r from-emerald-600 to-green-600 rounded-full mt-0.5" />
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
            <AlertCircle className="w-4 h-4" />
            <span className="flex-1">{error}</span>
            <button className="text-sm" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* Billing Account Balances */}
        {accountBalances.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Billing Account Balances</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {accountBalances.map(acc => (
                <div key={acc.accountId} className="bg-white rounded-xl border border-slate-200 p-3">
                  <div className="text-xs text-slate-500 mb-1">{acc.accountName}</div>
                  <div className="text-lg font-bold text-slate-900">₹{(acc.balance || 0).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-sm text-slate-600">Total Received (Unassigned)</div>
            <div className="text-2xl font-bold text-slate-900">₹{(summary.total || 0).toLocaleString()}</div>
          </div>
          <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4">
            <div className="text-sm text-emerald-700">Remaining to Assign</div>
            <div className="text-2xl font-bold text-emerald-900">₹{(Math.max(0, summary.remaining || 0)).toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-sm text-slate-600">Entries</div>
            <div className="text-2xl font-bold text-slate-900">{items.length}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className="pl-10 pr-3 py-2 border rounded-xl" placeholder="Search title/source/notes" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            </div>
            <button onClick={load} className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 flex items-center gap-2"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
          </div>
          <div className="flex items-center gap-2">
            {SHOW_CLEANUP_BUTTON && isAdmin && (
              <button onClick={runCleanup} disabled={cleanupLoading} className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 flex items-center gap-2">
                {cleanupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Cleanup
              </button>
            )}
            <button onClick={openReceive} className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2"><Plus className="w-4 h-4" /> Receive from Billing Account</button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No untransferred funds yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Source</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Remaining</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Received</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <tr key={it._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{it.title}</td>
                      <td className="px-4 py-3 text-slate-700">{it.source || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">₹{(it.amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">₹{(Math.max(0, ((it.remainingAmount ?? it.amount) ?? 0))).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{it.receivedAt ? new Date(it.receivedAt).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setDetailsItem(it); setShowDetails(true); }} className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50">View</button>
                          <button onClick={() => openTransfer(it)} className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50 flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Transfer to Account</button>
                          <button onClick={() => removeItem(it._id)} disabled={deletingId === it._id} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50">
                            {deletingId === it._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Remove
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

        {/* Info Note */}
        <div className="mt-4 p-3 rounded-xl bg-blue-50 text-blue-700 text-sm border border-blue-200">
          <strong>Note:</strong> When you transfer funds to a billing account, they appear as inflow entries in the Funds page with a <span className="font-semibold">&apos;Transfer&apos;</span> badge. 
          Once transferred, items with remaining amount of 0 are automatically hidden from this list.
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && selectedItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-4 border-b font-semibold">Transfer to Billing Account</div>
            <form onSubmit={submitTransfer} className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Billing Account *</label>
                <select required className="w-full border rounded-xl px-3 py-2" value={transferForm.accountId} onChange={(e) => setTransferForm({ ...transferForm, accountId: e.target.value })}>
                  <option value="">Select account</option>
                  {accounts.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount (₹) *</label>
                <input required type="number" className="w-full border rounded-xl px-3 py-2" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Inflow Type</label>
                <select className="w-full border rounded-xl px-3 py-2" value={transferForm.inflowType} onChange={(e) => setTransferForm({ ...transferForm, inflowType: e.target.value })}>
                  <option value="grant">Grant</option>
                  <option value="donation">Donation</option>
                  <option value="other_income">Other Income</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input type="date" className="w-full border rounded-xl px-3 py-2" value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <input className="w-full border rounded-xl px-3 py-2" value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="px-4 py-2 rounded-lg border" onClick={() => setShowTransferModal(false)}>Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} {isSaving ? 'Transferring...' : 'Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-4 border-b font-semibold">Move from Billing Account to Untransferred</div>
            <form onSubmit={submitReceive} className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Billing Account *</label>
                <select required className="w-full border rounded-xl px-3 py-2" value={receiveForm.accountId} onChange={(e) => setReceiveForm({ ...receiveForm, accountId: e.target.value })}>
                  <option value="">Select account</option>
                  {accounts.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input required className="w-full border rounded-xl px-3 py-2" value={receiveForm.title} onChange={(e) => setReceiveForm({ ...receiveForm, title: e.target.value })} placeholder="e.g., Reallocation - Reserve" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount (₹) *</label>
                <input required type="number" className="w-full border rounded-xl px-3 py-2" value={receiveForm.amount} onChange={(e) => setReceiveForm({ ...receiveForm, amount: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input type="date" className="w-full border rounded-xl px-3 py-2" value={receiveForm.date} onChange={(e) => setReceiveForm({ ...receiveForm, date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <input className="w-full border rounded-xl px-3 py-2" value={receiveForm.notes} onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="px-4 py-2 rounded-lg border" onClick={() => setShowReceiveModal(false)}>Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} {isSaving ? 'Moving...' : 'Move'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && detailsItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-semibold">Untransferred Details</div>
              <button className="px-3 py-1.5 rounded-lg border" onClick={() => setShowDetails(false)}>Close</button>
            </div>
            <div className="p-4 overflow-y-auto">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 mb-4 border border-emerald-200">
                <div className="text-sm text-emerald-700 mb-1">Total Amount</div>
                <div className="text-2xl font-bold text-emerald-900">₹{(detailsItem.amount||0).toLocaleString()}</div>
                <div className="text-sm text-emerald-700 mt-2">Remaining: <span className="font-semibold">₹{(Math.max(0, ((detailsItem.remainingAmount ?? detailsItem.amount) ?? 0))).toLocaleString()}</span></div>
                <div className="text-sm text-emerald-700">Transferred: <span className="font-semibold">₹{(Math.max(0, (detailsItem.amount || 0) - Math.max(0, ((detailsItem.remainingAmount ?? detailsItem.amount) ?? 0)))).toLocaleString()}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><div className="text-xs text-slate-500">Title</div><div className="font-medium">{detailsItem.title}</div></div>
                <div><div className="text-xs text-slate-500">Source</div><div className="font-medium">{detailsItem.source || '—'}</div></div>
                <div><div className="text-xs text-slate-500">Received Date</div><div className="font-medium">{detailsItem.receivedAt ? new Date(detailsItem.receivedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</div></div>
                <div><div className="text-xs text-slate-500">Related Grant</div><div className="font-medium">{detailsItem.relatedApplicationId ? 'Yes' : 'No'}</div></div>
              </div>
              {detailsItem.notes && (
                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-1">Notes</div>
                  <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap">{detailsItem.notes}</div>
                </div>
              )}
              <div>
                <div className="mb-2 font-semibold">History</div>
                <div className="space-y-2">
                  {(detailsItem.history || []).length === 0 && <div className="text-sm text-slate-500">No history yet.</div>}
                  {(detailsItem.history || []).map((h, idx) => (
                    <div key={idx} className="p-2 rounded-lg border bg-slate-50 text-sm flex items-center justify-between">
                      <div>
                        <div className="font-medium">{(h.type ? h.type.replace(/_/g,' ') : '—')}</div>
                        <div className="text-slate-600">Amount: ₹{(h.amount||0).toLocaleString()}</div>
                        {h.accountId && <div className="text-slate-600">Account: {h.accountId}</div>}
                      </div>
                      <div className="text-xs text-slate-500">{h.at ? new Date(h.at).toLocaleString() : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
