import { useCallback, useEffect, useMemo, useState } from 'react';
import { numberFmt } from '../_components/constants';

export default function useFundsData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ received: 0, spent: 0, balance: 0 });
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);

  const [filters, setFilters] = useState({ search: '', category: '', kind: '', startDate: '', endDate: '', datePreset: 'thisYear', groupBy: 'month', accountId: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // If accountId not set, do not call API (server requires it)
      if (!filters.accountId) {
        setItems([]);
        setSummary({ received: 0, spent: 0, balance: 0 });
        setCategoryBreakdown([]);
        setMonthlyTrends([]);
        return;
      }
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.category) params.append('category', filters.category);
      if (filters.kind) params.append('kind', filters.kind);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.groupBy) params.append('groupBy', filters.groupBy);
      if (filters.datePreset) params.append('datePreset', filters.datePreset);
      if (filters.accountId) params.append('accountId', filters.accountId);
      // Don't exclude transfers - they represent real fund movements into billing accounts
      const res = await fetch(`/api/organization/funds?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to load funds');
      }
      const data = await res.json();
      setItems(data.items || []);
      setSummary(data.summary || { received: 0, spent: 0, balance: 0 });
      setCategoryBreakdown(data.categoryBreakdown || []);
      setMonthlyTrends((data.timeTrends || data.monthlyTrends) || []);
      setError(null);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const saveEntry = useCallback(async (payload, existingId) => {
    setError(null);
    const url = existingId ? `/api/organization/funds/${existingId}` : '/api/organization/funds';
    const method = existingId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Failed to save');
    }
    await load();
  }, [load]);

  const deleteEntry = useCallback(async (id) => {
    const res = await fetch(`/api/organization/funds/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error('Failed to delete');
    await load();
  }, [load]);

  const exportCSV = useCallback(() => {
    const headers = ['Date', 'Type', 'Category', 'Title', 'Amount', 'Notes'];
    const rows = items.map((it) => [
      new Date(it.date).toLocaleDateString(),
      it.kind === 'in' ? 'Received' : 'Spent',
      it.category,
      it.title,
      it.amount,
      it.notes || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `funds-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }, [items]);

  const chartData = useMemo(() => {
    const map = {};
    const gb = filters.groupBy || 'month';
    monthlyTrends.forEach((t) => {
      let key;
      if (gb === 'day') {
        const y = t._id.year; const m = String(t._id.month || 1).padStart(2, '0'); const d = String(t._id.day || 1).padStart(2, '0');
        key = `${y}-${m}-${d}`;
      } else if (gb === 'week') {
        key = `${t._id.isoWeekYear}-W${String(t._id.isoWeek || 1).padStart(2, '0')}`;
      } else if (gb === 'year') {
        key = `${t._id.year}`;
      } else {
        key = `${t._id.year}-${String(t._id.month || 1).padStart(2, '0')}`;
      }
      const labelKey = gb === 'year' ? 'year' : gb === 'week' ? 'week' : gb === 'day' ? 'day' : 'month';
      if (!map[key]) map[key] = { [labelKey]: key, received: 0, spent: 0 };
      if (t._id.kind === 'in') map[key].received = t.total;
      else map[key].spent = t.total;
    });
    const arr = Object.values(map);
    return arr.sort((a, b) => (a.year || a.week || a.day || a.month).localeCompare((b.year || b.week || b.day || b.month)));
  }, [monthlyTrends, filters.groupBy]);

  const pieData = useMemo(() => {
    const catTotals = {};
    categoryBreakdown.forEach((c) => {
      const cat = (c._id && (c._id.group || c._id.category)) || 'other';
      catTotals[cat] = (catTotals[cat] || 0) + c.total;
    });
    return Object.entries(catTotals).map(([name, value]) => ({ name, value }));
  }, [categoryBreakdown]);

  // New: Inflow and Outflow breakdowns by type
  const inflowPieData = useMemo(() => {
    const totals = {};
    categoryBreakdown
      .filter((c) => c._id && c._id.kind === 'in')
      .forEach((c) => {
        const name = c._id.group || 'other_income';
        totals[name] = (totals[name] || 0) + c.total;
      });
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [categoryBreakdown]);

  const outflowPieData = useMemo(() => {
    const totals = {};
    categoryBreakdown
      .filter((c) => c._id && c._id.kind === 'out')
      .forEach((c) => {
        const name = c._id.group || 'other';
        totals[name] = (totals[name] || 0) + c.total;
      });
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [categoryBreakdown]);

  const runway = useMemo(() => {
    const outs = monthlyTrends.filter((t) => t._id.kind === 'out');
    const last3 = outs.slice(-3);
    if (last3.length === 0) return null;
    const avgBurn = last3.reduce((s, m) => s + m.total, 0) / last3.length;
    if (!avgBurn) return null;
    return Math.floor((summary.balance || 0) / avgBurn);
  }, [monthlyTrends, summary.balance]);

  return {
    loading,
    error,
    setError,
    items,
    summary,
    categoryBreakdown,
    monthlyTrends,
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
  };
}
