'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Edit2, Trash2, AlertCircle, Check, X as CloseIcon, Loader2 } from 'lucide-react';
import useBillingAccount from '../../funds/_hooks/useBillingAccount';

export default function AccountsPage() {
  const { accounts, activeAccountId, addAccount, selectAccount, renameAccount, deleteAccount, loadAccounts, loading } = useBillingAccount();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  const hasAccounts = accounts && accounts.length > 0;
  const sorted = useMemo(() => accounts.slice().sort((a, b) => a.name.localeCompare(b.name)), [accounts]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { setError('Account name is required'); return; }
    try {
      setCreating(true);
      await addAccount(name);
      setNewName('');
    } catch (e) {
      setError(e.message || 'Failed to create account');
    } finally {
      setCreating(false);
    }
  };

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
                <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-600 p-2 rounded-xl" />
                <div>
                  <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">Billing Accounts</span>
                  <div className="h-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full mt-0.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="flex-1">{error}</span>
            <button className="text-sm" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* Create */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 mb-6">
          <h2 className="text-lg font-semibold mb-3">Create a new account</h2>
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-xl px-3 py-2"
              placeholder="Account name, e.g., Main Org, India Ops, Project A"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button onClick={handleCreate} disabled={creating} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              <Plus className="w-4 h-4" /> {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Accounts</h2>
            {!hasAccounts && <span className="text-sm text-slate-500">No accounts yet. Create one to get started.</span>}
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : !hasAccounts ? (
            <div className="py-10 text-center text-slate-500">You have no billing accounts. Use the form above to create one.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sorted.map((acc) => (
                <li key={acc.id} className="py-3 flex items-center justify-between transition-colors hover:bg-slate-50 rounded-lg px-2 -mx-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      checked={activeAccountId === acc.id}
                      onChange={() => selectAccount(acc.id)}
                      className="accent-indigo-600"
                      title="Set active"
                    />
                    {editingId === acc.id ? (
                      <div className="flex items-center gap-2">
                        <input className="border rounded px-2 py-1 text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        <button className="px-2 py-1 rounded bg-emerald-600 text-white text-xs flex items-center gap-1" onClick={async () => {
                          if (!editName.trim()) return;
                          setBusyId(acc.id);
                          try { await renameAccount(acc.id, editName.trim()); setEditingId(null); } catch (e) { setError(e.message || 'Failed to rename'); } finally { setBusyId(null); }
                        }}><Check className="w-3 h-3" /> Save</button>
                        <button className="px-2 py-1 rounded border text-xs" onClick={() => setEditingId(null)}><CloseIcon className="w-3 h-3" /> Cancel</button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className="font-medium text-slate-900">{acc.name}</span>
                          <div className="text-xs text-slate-500">
                            Created {acc.createdAt ? new Date(acc.createdAt).toLocaleDateString() : '—'}
                            {acc.createdBy?.username ? ` • by ${acc.createdBy.username}` : ''}
                          </div>
                        </div>
                        {activeAccountId === acc.id && (
                          <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">Active</span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingId !== acc.id && (
                      <button
                        className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                        onClick={() => { setEditingId(acc.id); setEditName(acc.name); }}
                      >
                        <Edit2 className="w-4 h-4" /> Rename
                      </button>
                    )}
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

        {/* Confirm Delete Modal */}
        {confirmId && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border shadow-xl w-full max-w-md">
              <div className="p-4 border-b font-semibold">Delete Account</div>
              {(() => {
                const acc = accounts.find(a => a.id === confirmId);
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
                        try { await deleteAccount(confirmId); setConfirmId(null); } catch (e) { setError(e.message || 'Failed to delete'); } finally { setBusyId(null); }
                      }}>{busyId === confirmId ? (<><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>) : 'Delete'}</button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}