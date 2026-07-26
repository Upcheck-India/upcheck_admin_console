'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus, Edit2, Trash2, AlertCircle, Check, X as CloseIcon, Loader2,
  Landmark, ShieldCheck, ShieldQuestion,
} from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import UnauthorizedAccess from '../../../../components/UnauthorizedAccess';
import { CURRENCIES } from '../../../../lib/finance/currency';
import useBillingAccount from '../../funds/_hooks/useBillingAccount';

const ACCOUNT_TYPES = [
  { value: '', label: '—' },
  { value: 'savings', label: 'Savings' },
  { value: 'current', label: 'Current' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM = {
  name: '',
  currency: 'INR',
  bankName: '',
  accountHolderName: '',
  accountNumber: '',
  ifsc: '',
  branch: '',
  accountType: '',
  upiId: '',
};

export default function AccountsPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');

  const {
    accounts, activeAccountId, selectAccount, deleteAccount, loadAccounts, loading,
  } = useBillingAccount();

  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Create / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null => create
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [existingMasked, setExistingMasked] = useState(null); // masked placeholder on edit
  const [clearBank, setClearBank] = useState(false);

  // Delete modal
  const [confirmId, setConfirmId] = useState(null);
  const [confirmInput, setConfirmInput] = useState('');

  // Verify modal
  const [verifyId, setVerifyId] = useState(null);
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null); // { match, last4 }

  const hasAccounts = accounts && accounts.length > 0;
  const sorted = useMemo(
    () => accounts.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [accounts]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setExistingMasked(null);
    setClearBank(false);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (acc) => {
    setEditingId(acc.id);
    setForm({
      name: acc.name || '',
      currency: acc.currency || 'INR',
      bankName: acc.bank?.bankName || '',
      accountHolderName: acc.bank?.accountHolderName || '',
      accountNumber: '', // never prefilled — the stored number is never retrievable
      ifsc: acc.bank?.ifsc || '',
      branch: acc.bank?.branch || '',
      accountType: acc.bank?.accountType || '',
      upiId: acc.bank?.upiId || '',
    });
    setExistingMasked(acc.bank?.accountNumberMasked || null);
    setClearBank(false);
    setError(null);
    setModalOpen(true);
  };

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) { setError('Account name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = { name, currency: form.currency };
      if (clearBank) {
        payload.clearBank = true;
      } else {
        const bank = {
          bankName: form.bankName,
          accountHolderName: form.accountHolderName,
          branch: form.branch,
          ifsc: form.ifsc,
          accountType: form.accountType,
          upiId: form.upiId,
        };
        // Only send the account number when the user actually typed one. Blank
        // on edit means "keep the stored (encrypted) number".
        if (form.accountNumber.trim()) bank.accountNumber = form.accountNumber.trim();
        payload.bank = bank;
      }

      const url = editingId
        ? `/api/organization/accounts/${editingId}`
        : '/api/organization/accounts';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = 'Failed to save account';
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
        throw new Error(msg);
      }
      const saved = await res.json();
      const savedId = saved._id?.toString?.() || saved.id;
      await loadAccounts();
      if (!editingId && savedId) selectAccount(savedId);
      setModalOpen(false);
    } catch (e) {
      setError(e.message || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyId || !verifyInput.trim()) return;
    setVerifyBusy(true);
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/organization/accounts/${verifyId}/verify-bank`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber: verifyInput.trim() }),
      });
      if (!res.ok) {
        let msg = 'Failed to verify';
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
        throw new Error(msg);
      }
      setVerifyResult(await res.json());
    } catch (e) {
      setError(e.message || 'Failed to verify');
      setVerifyId(null);
    } finally {
      setVerifyBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAdmin) return <UnauthorizedAccess />;

  const verifyAcc = verifyId ? accounts.find((a) => a.id === verifyId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/organization/finance" className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl" title="Back">
                ← Back
              </Link>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-600 p-2 rounded-xl">
                  <Landmark className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">Billing Accounts</span>
                  <div className="h-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full mt-0.5" />
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <button onClick={openCreate} className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 flex items-center gap-2 shadow-md">
                <Plus className="w-4 h-4" /> New account
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button className="text-sm hover:underline" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your accounts</h2>
            {hasAccounts && <span className="text-sm text-slate-500">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>}
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => (<div key={i} className="h-16 rounded-xl bg-slate-100" />))}
            </div>
          ) : !hasAccounts ? (
            <div className="py-12 text-center text-slate-500">
              <Landmark className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>You have no billing accounts yet.</p>
              <button onClick={openCreate} className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create your first account
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sorted.map((acc) => (
                <li key={acc.id} className="py-4 flex items-start justify-between gap-3 transition-colors hover:bg-slate-50 rounded-lg px-2 -mx-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="radio"
                      checked={activeAccountId === acc.id}
                      onChange={() => selectAccount(acc.id)}
                      className="mt-1 accent-indigo-600"
                      title="Set active"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 truncate">{acc.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">{acc.currency || 'INR'}</span>
                        {activeAccountId === acc.id && (
                          <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">Active</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        {acc.bank?.hasBankDetails ? (
                          <span className="inline-flex items-center gap-2 flex-wrap">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span className="text-slate-700">{acc.bank.bankName || 'Bank'}</span>
                            <span className="font-mono text-slate-600">{acc.bank.accountNumberMasked}</span>
                            {acc.bank.ifsc && <span className="text-slate-500">IFSC {acc.bank.ifsc}</span>}
                          </span>
                        ) : (
                          <span className="text-slate-400">No bank details</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    {acc.bank?.hasBankDetails && (
                      <button
                        className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                        onClick={() => { setVerifyId(acc.id); setVerifyInput(''); setVerifyResult(null); }}
                        title="Verify account number"
                      >
                        <ShieldQuestion className="w-4 h-4" /> Verify
                      </button>
                    )}
                    <button
                      className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                      onClick={() => openEdit(acc)}
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1"
                      onClick={() => { setConfirmId(acc.id); setConfirmInput(''); }}
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border shadow-xl w-full max-w-lg my-8">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="font-semibold">{editingId ? 'Edit account' : 'New account'}</span>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-slate-100"><CloseIcon className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Account name</label>
                <input className="w-full border rounded-xl px-3 py-2" placeholder="e.g., Main Org, India Ops" value={form.name} onChange={(e) => setField('name', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Base currency</label>
                <select className="w-full border rounded-xl px-3 py-2 bg-white" value={form.currency} onChange={(e) => setField('currency', e.target.value)}>
                  {CURRENCIES.map((c) => (<option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>))}
                </select>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Landmark className="w-4 h-4 text-indigo-600" /> Bank details</h3>
                  {editingId && existingMasked && (
                    <label className="text-xs text-slate-600 flex items-center gap-1.5">
                      <input type="checkbox" checked={clearBank} onChange={(e) => setClearBank(e.target.checked)} className="accent-red-600" />
                      Clear bank details
                    </label>
                  )}
                </div>

                {clearBank ? (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Bank details will be removed from this account when you save.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">Bank name</label>
                      <input className="w-full border rounded-lg px-3 py-2" value={form.bankName} onChange={(e) => setField('bankName', e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">Account holder name</label>
                      <input className="w-full border rounded-lg px-3 py-2" value={form.accountHolderName} onChange={(e) => setField('accountHolderName', e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">Account number</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        className="w-full border rounded-lg px-3 py-2 font-mono"
                        placeholder={existingMasked ? `${existingMasked} (leave blank to keep)` : 'Enter account number'}
                        value={form.accountNumber}
                        onChange={(e) => setField('accountNumber', e.target.value)}
                      />
                      <p className="text-xs text-slate-500 mt-1">Stored encrypted; only the last 4 digits are ever shown.{editingId && existingMasked ? ' Leave blank to keep the existing number.' : ''}</p>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">IFSC</label>
                      <input className="w-full border rounded-lg px-3 py-2 uppercase" placeholder="SBIN0001234" value={form.ifsc} onChange={(e) => setField('ifsc', e.target.value.toUpperCase())} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Account type</label>
                      <select className="w-full border rounded-lg px-3 py-2 bg-white" value={form.accountType} onChange={(e) => setField('accountType', e.target.value)}>
                        {ACCOUNT_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Branch</label>
                      <input className="w-full border rounded-lg px-3 py-2" value={form.branch} onChange={(e) => setField('branch', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">UPI ID <span className="text-slate-400">(public)</span></label>
                      <input className="w-full border rounded-lg px-3 py-2" placeholder="name@bank" value={form.upiId} onChange={(e) => setField('upiId', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button className="px-4 py-2 rounded-xl border" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2" onClick={handleSave} disabled={saving}>
                {saving ? (<><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>) : (<><Check className="w-4 h-4" /> Save</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify modal */}
      {verifyId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="font-semibold">Verify account number</span>
              <button onClick={() => setVerifyId(null)} className="p-1 rounded hover:bg-slate-100"><CloseIcon className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-600">
                We never show the stored number; enter one to confirm it matches what&apos;s on file for
                <span className="font-medium text-slate-800"> {verifyAcc?.name}</span>.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="w-full border rounded-lg px-3 py-2 font-mono"
                placeholder="Enter account number to check"
                value={verifyInput}
                onChange={(e) => { setVerifyInput(e.target.value); setVerifyResult(null); }}
              />
              {verifyResult && (
                verifyResult.match ? (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" />
                    <span>Match — this is the account on file{verifyResult.last4 ? ` (••••${verifyResult.last4})` : ''}.</span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
                    <CloseIcon className="w-5 h-5" />
                    <span>No match — this number does not match what&apos;s on file{verifyResult.last4 ? ` (••••${verifyResult.last4})` : ''}.</span>
                  </div>
                )
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button className="px-4 py-2 rounded-xl border" onClick={() => setVerifyId(null)}>Close</button>
              <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2" onClick={handleVerify} disabled={verifyBusy || !verifyInput.trim()}>
                {verifyBusy ? (<><Loader2 className="w-4 h-4 animate-spin" /> Checking...</>) : 'Check'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {confirmId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border shadow-xl w-full max-w-md">
            <div className="p-4 border-b font-semibold">Delete account</div>
            {(() => {
              const acc = accounts.find((a) => a.id === confirmId);
              const isActive = activeAccountId === confirmId;
              const mustType = acc?.name || '';
              const disabled = isActive || (confirmInput.trim() !== mustType.trim()) || busyId === confirmId;
              return (
                <>
                  <div className="p-4 text-slate-700 space-y-3">
                    <p>Type the account name <span className="font-semibold">{acc?.name}</span> to confirm deletion. This cannot be undone.</p>
                    {isActive && (
                      <div className="p-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-sm">You cannot delete the active account. Please switch to another account first.</div>
                    )}
                    <input className="w-full border rounded px-3 py-2" placeholder={acc?.name || ''} value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} />
                  </div>
                  <div className="p-4 flex justify-end gap-2 border-t">
                    <button className="px-4 py-2 rounded border" onClick={() => setConfirmId(null)}>Cancel</button>
                    <button disabled={disabled} className={`px-4 py-2 rounded text-white ${disabled ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} flex items-center gap-2`} onClick={async () => {
                      setBusyId(confirmId);
                      setError(null);
                      try { await deleteAccount(confirmId); setConfirmId(null); } catch (e) { setError(e.message || 'Failed to delete'); setConfirmId(null); } finally { setBusyId(null); }
                    }}>{busyId === confirmId ? (<><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>) : 'Delete'}</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
