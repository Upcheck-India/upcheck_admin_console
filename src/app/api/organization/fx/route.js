import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { requireFinanceAdmin } from '../../../../lib/finance/auth';
import {
  getRate,
  convertMinor,
  normalizeCurrency,
  CURRENCIES,
  BASE_CURRENCY,
} from '../../../../lib/finance/currency';
import { toMinor, fromMinor } from '../../../../lib/finance/money';

// GET /api/organization/fx
//   ?from=USD&to=INR&amount=100  -> { from, to, rate, date, source, amount, converted }
//   ?base=INR                    -> { base, rates: [{ code, rate, date, source }, ...] }
//
// Read-only (no mutation) so it only requires a finance admin, not the CSRF
// guard. `getRate` is passed { db } so rates persist to `fx_rates` and a stored
// value can be used as a fallback when every live provider is briefly down.
export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const client = await clientPromise;
    const db = client.db('resources');

    const { searchParams } = new URL(request.url);
    const base = searchParams.get('base');
    const fromRaw = searchParams.get('from');
    const toRaw = searchParams.get('to');
    const amountRaw = searchParams.get('amount');

    // Table mode: a small matrix of rates for every supported currency vs base.
    if (base && !fromRaw && !toRaw) {
      const b = normalizeCurrency(base); // throws FinanceError 400 on unsupported
      const rates = [];
      for (const c of CURRENCIES) {
        if (c.code === b) {
          rates.push({ code: c.code, rate: 1, date: null, source: 'identity' });
          continue;
        }
        try {
          const r = await getRate(b, c.code, { db });
          rates.push({ code: c.code, rate: r.rate, date: r.date, source: r.source });
        } catch {
          // One unavailable pair must not sink the whole table.
          rates.push({ code: c.code, rate: null, date: null, source: null });
        }
      }
      return NextResponse.json({ base: b, rates });
    }

    // Single-pair mode.
    const from = normalizeCurrency(fromRaw); // throws 400 on unsupported
    const to = normalizeCurrency(toRaw, { def: BASE_CURRENCY });
    const { rate, date, source } = await getRate(from, to, { db });

    let amount = null;
    let converted = null;
    if (amountRaw != null && amountRaw !== '') {
      amount = Number(amountRaw);
      const amountMinor = toMinor(amountRaw); // validates the amount
      converted = fromMinor(convertMinor(amountMinor, rate));
    }

    return NextResponse.json({ from, to, rate, date, source, amount, converted });
  } catch (e) {
    if (e && e.isFinanceError) {
      return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    }
    console.error('GET /api/organization/fx error', e);
    return NextResponse.json({ error: 'Failed to fetch exchange rate' }, { status: 500 });
  }
}
