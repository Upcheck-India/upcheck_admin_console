import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'billing_accounts_v1';
const ACTIVE_KEY = 'active_billing_account_id_v1';

// Map a server (sanitized) account onto the compact shape the UI consumes. The
// server never sends the encrypted number or its fingerprint, so `bank` here is
// purely a display summary (masked number + IFSC + bank name).
function mapAccount(a) {
  if (!a) return null;
  const bank = a.bank
    ? {
        bankName: a.bank.bankName || null,
        accountNumberMasked: a.bank.accountNumberMasked || null,
        accountNumberLast4: a.bank.accountNumberLast4 || null,
        ifsc: a.bank.ifsc || null,
        accountHolderName: a.bank.accountHolderName || null,
        branch: a.bank.branch || null,
        accountType: a.bank.accountType || null,
        upiId: a.bank.upiId || null,
        hasBankDetails: !!a.bank.hasBankDetails,
      }
    : null;
  return {
    id: a._id?.toString?.() || a.id,
    name: a.name,
    currency: a.currency || 'INR',
    bank,
    hasBankDetails: !!a.hasBankDetails,
    createdAt: a.createdAt,
    createdBy: a.createdBy,
    updatedAt: a.updatedAt,
  };
}

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
      const list = Array.isArray(data.accounts) ? data.accounts.map(mapAccount).filter(Boolean) : [];
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

  // addAccount(name) stays backward-compatible for the AccountSelector's onAdd.
  // An optional second argument carries currency + bank details for the manage
  // page's create flow.
  const addAccount = useCallback(async (name, extra = {}) => {
    const payload = { name };
    if (extra && typeof extra === 'object') {
      if (extra.currency) payload.currency = extra.currency;
      if (extra.bank) payload.bank = extra.bank;
    }
    const res = await fetch('/api/organization/accounts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let msg = 'Failed to create account';
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
    const created = mapAccount(await res.json());
    const id = created.id;
    const list = [...accounts, created];
    saveAccounts(list);
    setActiveAccountId(id);
    try { localStorage.setItem(ACTIVE_KEY, id); } catch {}
    return created;
  }, [accounts, saveAccounts]);

  const selectAccount = useCallback((id) => {
    setActiveAccountId(id || null);
    try { localStorage.setItem(ACTIVE_KEY, id || ''); } catch {}
  }, []);

  const activeAccount = accounts.find(a => a.id === activeAccountId) || null;

  const renameAccount = useCallback(async (id, name) => {
    const res = await fetch(`/api/organization/accounts/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      let msg = 'Failed to rename account';
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
    const updated = mapAccount(await res.json());
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
  }, []);

  const deleteAccount = useCallback(async (id) => {
    const res = await fetch(`/api/organization/accounts/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) {
      let msg = 'Failed to delete account';
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
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
