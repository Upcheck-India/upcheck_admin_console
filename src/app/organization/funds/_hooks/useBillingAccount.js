import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'billing_accounts_v1';
const ACTIVE_KEY = 'active_billing_account_id_v1';

export default function useBillingAccount() {
  const [accounts, setAccounts] = useState([]);
  const [activeAccountId, setActiveAccountId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/organization/accounts', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load accounts');
      const data = await res.json();
      const list = Array.isArray(data.accounts)
        ? data.accounts.map(a => ({
            id: a._id?.toString?.() || a.id,
            name: a.name,
            createdAt: a.createdAt,
            createdBy: a.createdBy,
            updatedAt: a.updatedAt,
          }))
        : [];
      setAccounts(list);
      const active = localStorage.getItem(ACTIVE_KEY);
      setActiveAccountId(active || (list[0]?.id || null));
    } catch (e) {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const saveAccounts = useCallback((list) => {
    setAccounts(list);
  }, []);

  const addAccount = useCallback(async (name) => {
    const res = await fetch('/api/organization/accounts', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!res.ok) throw new Error('Failed to create account');
    const created = await res.json();
    const id = created._id?.toString?.() || created.id;
    const list = [...accounts, { id, name: created.name }];
    saveAccounts(list);
    setActiveAccountId(id);
    try { localStorage.setItem(ACTIVE_KEY, id); } catch {}
    return { id, name: created.name };
  }, [accounts, saveAccounts]);

  const selectAccount = useCallback((id) => {
    setActiveAccountId(id || null);
    try { localStorage.setItem(ACTIVE_KEY, id || ''); } catch {}
  }, []);

  const activeAccount = accounts.find(a => a.id === activeAccountId) || null;

  const renameAccount = useCallback(async (id, name) => {
    const res = await fetch(`/api/organization/accounts/${id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!res.ok) throw new Error('Failed to rename account');
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, name: name.trim() } : a)));
  }, []);

  const deleteAccount = useCallback(async (id) => {
    const res = await fetch(`/api/organization/accounts/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error('Failed to delete account');
    setAccounts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (activeAccountId === id) {
        const newActive = next[0]?.id || null;
        setActiveAccountId(newActive);
        try { localStorage.setItem(ACTIVE_KEY, newActive || ''); } catch {}
      }
      return next;
    });
  }, [activeAccountId]);

  return {
    accounts,
    activeAccount,
    activeAccountId,
    loading,
    addAccount,
    selectAccount,
    renameAccount,
    deleteAccount,
    setAccounts: saveAccounts,
    loadAccounts,
  };
}
