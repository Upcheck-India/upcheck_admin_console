'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftRight, Loader2, AlertTriangle } from 'lucide-react';
import { CURRENCIES, formatCurrency } from './constants';

// Self-contained FX converter. Reads live daily reference rates from
// /api/organization/fx (which freezes/persists nothing here — this is a
// read-only helper). Debounced on every input change.
export default function CurrencyConverter() {
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('INR');
  const [amount, setAmount] = useState('100');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setResult(null);
      setError(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ from, to, amount: String(amt) });
        const res = await fetch(`/api/organization/fx?${params.toString()}`, { credentials: 'include' });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Failed to fetch rate');
        }
        const data = await res.json();
        if (cancelled) return;
        setResult(data);
      } catch (e) {
        if (cancelled) return;
        setResult(null);
        setError(e.message || 'Failed to fetch rate');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [from, to, amount]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
        Currency Converter
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-slate-700">From</label>
          <select value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full border rounded px-3 py-2">
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={swap}
          className="mb-1 mx-auto p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          title="Swap currencies"
          aria-label="Swap currencies"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>
        <div>
          <label className="block text-sm font-medium text-slate-700">To</label>
          <select value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full border rounded px-3 py-2">
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-sm font-medium text-slate-700">Amount</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2"
          placeholder="Enter an amount"
        />
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 min-h-[64px] flex flex-col justify-center">
        {loading ? (
          <span className="inline-flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Fetching rate…
          </span>
        ) : error ? (
          <span className="inline-flex items-center gap-2 text-amber-700 text-sm">
            <AlertTriangle className="w-4 h-4" /> {error}
          </span>
        ) : result ? (
          <>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(result.converted, to)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              1 {from} = {formatCurrency(result.rate, to)}
              {result.date ? ` · as of ${result.date}` : ''}
              {result.source ? ` · ${result.source}` : ''}
            </div>
          </>
        ) : (
          <span className="text-slate-500 text-sm">Enter an amount to convert.</span>
        )}
      </div>
    </div>
  );
}
