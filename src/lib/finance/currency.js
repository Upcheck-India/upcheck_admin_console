// src/lib/finance/currency.js
//
// Multi-currency support for the finance module. INR is the base/reporting
// currency; every foreign-currency amount is converted to INR and that rate is
// FROZEN on the transaction at entry time (so historical reports never move
// when today's rate moves).
//
// Rates come from free, keyless providers, tried in order with graceful
// fallback, then cached in-process and persisted to the `fx_rates` collection
// so a value is always available even if every provider is briefly down:
//   1. frankfurter.dev   (ECB reference rates)      { amount, base, date, rates:{QUOTE} }
//   2. open.er-api.com   (ExchangeRate-API open)    { result, base_code, rates:{QUOTE} }
//   3. @fawazahmed0/currency-api via jsDelivr (CDN) { date, base:{quote} }  (lowercase)
//
// NOTE: these are daily reference rates, not intraday tick data — appropriate
// for accounting, and free. `getRate` returns the provider's `date` so the UI
// can show "as of".
import { FinanceError } from './tx';

export const BASE_CURRENCY = 'INR';

// Supported currencies (code, name, symbol). INR first (default). Kept to
// widely-used currencies a India-based nonprofit is likely to receive.
export const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
];

const CODE_SET = new Set(CURRENCIES.map((c) => c.code));

export function isSupportedCurrency(code) {
  return typeof code === 'string' && CODE_SET.has(code.toUpperCase());
}

/** Normalize/validate a currency code, defaulting to INR. Throws on unsupported. */
export function normalizeCurrency(code, { def = BASE_CURRENCY } = {}) {
  if (code == null || code === '') return def;
  const up = String(code).toUpperCase();
  if (!CODE_SET.has(up)) throw new FinanceError(`Unsupported currency: ${code}`, 400);
  return up;
}

// In-process cache: `${from}:${to}` -> { rate, date, source, fetchedAt(ms) }
const CACHE = new Map();
const TTL_MS = 6 * 60 * 60 * 1000; // 6h — providers refresh at most daily

function cacheGet(key) {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit;
  return null;
}
function cacheSet(key, val) {
  CACHE.set(key, { ...val, fetchedAt: Date.now() });
}

async function fetchJson(url, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// --- Providers: each returns { rate, date } for from->to, or throws. ---
async function fromFrankfurter(from, to) {
  const j = await fetchJson(`https://api.frankfurter.dev/v1/latest?from=${from}&to=${to}`);
  const rate = j && j.rates && j.rates[to];
  if (!Number.isFinite(Number(rate))) throw new Error('frankfurter: no rate');
  return { rate: Number(rate), date: j.date || null };
}
async function fromErApi(from, to) {
  const j = await fetchJson(`https://open.er-api.com/v6/latest/${from}`);
  const rate = j && j.rates && j.rates[to];
  if (j.result !== 'success' || !Number.isFinite(Number(rate))) throw new Error('er-api: no rate');
  const date = j.time_last_update_unix ? new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10) : null;
  return { rate: Number(rate), date };
}
async function fromFawaz(from, to) {
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  const j = await fetchJson(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${f}.json`);
  const rate = j && j[f] && j[f][t];
  if (!Number.isFinite(Number(rate))) throw new Error('fawaz: no rate');
  return { rate: Number(rate), date: j.date || null };
}

const PROVIDERS = [
  { name: 'frankfurter', fn: fromFrankfurter },
  { name: 'er-api', fn: fromErApi },
  { name: 'fawazahmed0', fn: fromFawaz },
];

/**
 * Get the exchange rate from `from` to `to` (1 unit of `from` = rate units of
 * `to`). Order of resolution: identity → in-process cache → live providers →
 * persisted `fx_rates` fallback. Pass `{ db }` to enable persistence + fallback.
 * Returns { rate, date, source }.
 */
export async function getRate(fromRaw, toRaw, { db = null } = {}) {
  const from = normalizeCurrency(fromRaw);
  const to = normalizeCurrency(toRaw);
  if (from === to) return { rate: 1, date: null, source: 'identity' };

  const key = `${from}:${to}`;
  const cached = cacheGet(key);
  if (cached) return { rate: cached.rate, date: cached.date, source: `${cached.source}(cache)` };

  let lastErr = null;
  for (const p of PROVIDERS) {
    try {
      const { rate, date } = await p.fn(from, to);
      cacheSet(key, { rate, date, source: p.name });
      if (db) {
        try {
          await db.collection('fx_rates').updateOne(
            { pair: key },
            { $set: { pair: key, from, to, rate, date, source: p.name, updatedAt: new Date() } },
            { upsert: true }
          );
        } catch {
          /* persistence is best-effort; never fail a conversion over it */
        }
      }
      return { rate, date, source: p.name };
    } catch (e) {
      lastErr = e;
    }
  }

  // All providers failed — fall back to the last persisted rate if we have one.
  if (db) {
    try {
      const doc = await db.collection('fx_rates').findOne({ pair: key });
      if (doc && Number.isFinite(Number(doc.rate))) {
        return { rate: Number(doc.rate), date: doc.date || null, source: `${doc.source || 'db'}(stale)` };
      }
    } catch {
      /* ignore */
    }
  }
  throw new FinanceError(`Unable to fetch exchange rate ${from}->${to}${lastErr ? `: ${lastErr.message}` : ''}`, 502);
}

/**
 * Convert integer minor units from one currency to another using a known rate.
 * Both sides are minor units (paise-equivalent, 2 decimal places). Rounded to
 * the nearest minor unit, half away from zero.
 */
export function convertMinor(amountMinor, rate) {
  const a = Math.round(Number(amountMinor) || 0);
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) throw new FinanceError('Invalid exchange rate', 400);
  return Math.round(a * r);
}

/** Validate a client-supplied FX rate (used when freezing a rate on a txn). */
export function assertValidRate(rate) {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0 || r > 1e9) throw new FinanceError('Invalid exchange rate', 400);
  return r;
}
