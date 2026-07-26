export const CATEGORIES = [
  { value: 'grant', label: 'Grant', color: '#3b82f6' },
  { value: 'donation', label: 'Donation', color: '#10b981' },
  { value: 'investment', label: 'Investment', color: '#8b5cf6' },
  { value: 'ops', label: 'Operations', color: '#f59e0b' },
  { value: 'payroll', label: 'Payroll', color: '#ef4444' },
  { value: 'marketing', label: 'Marketing', color: '#ec4899' },
  { value: 'infra', label: 'Infrastructure', color: '#06b6d4' },
  { value: 'other', label: 'Other', color: '#6b7280' }
];

export const numberFmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

// Multi-currency support. INR is the base/reporting currency (first entry, the
// default). This list is intentionally inlined (kept in sync with
// src/lib/finance/currency.js CURRENCIES) so this client-imported module never
// pulls the server-only currency/tx/mongodb chain into the browser bundle.
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

/** Look up a currency descriptor by code (defaults to INR). */
export function getCurrency(code) {
  const up = String(code || 'INR').toUpperCase();
  return CURRENCIES.find((c) => c.code === up) || CURRENCIES[0];
}

/**
 * Format an amount in its ORIGINAL currency using that currency's symbol and 2
 * decimals (Indian grouping). For INR this matches numberFmt. Use this for the
 * original-currency figure; use numberFmt for the INR-equivalent.
 */
export function formatCurrency(n, code) {
  const cur = getCurrency(code);
  const num = Number(n) || 0;
  if (cur.code === 'INR') return numberFmt(num);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  return `${cur.symbol}${formatted}`;
}

export const INFLOW_TYPES = [
  { value: 'grant', label: 'Grant', color: '#3b82f6' },
  { value: 'donation', label: 'Donation', color: '#10b981' },
  { value: 'investment', label: 'Investment', color: '#8b5cf6' },
  { value: 'revenue_sales', label: 'Revenue (Sales)', color: '#0ea5e9' },
  { value: 'revenue_service', label: 'Revenue (Service)', color: '#22c55e' },
  { value: 'interest_income', label: 'Interest Income', color: '#14b8a6' },
  { value: 'refund', label: 'Refund', color: '#84cc16' },
  { value: 'reimbursement', label: 'Reimbursement', color: '#06b6d4' },
  { value: 'capital_injection', label: 'Capital Injection', color: '#a855f7' },
  { value: 'other_income', label: 'Other Income', color: '#6b7280' }
];

export const EXPENSE_TYPES = [
  { value: 'payroll', label: 'Payroll', color: '#ef4444' },
  { value: 'operations', label: 'Operations', color: '#f59e0b' },
  { value: 'marketing', label: 'Marketing', color: '#ec4899' },
  { value: 'infrastructure', label: 'Infrastructure', color: '#06b6d4' },
  { value: 'travel', label: 'Travel', color: '#fb7185' },
  { value: 'utilities', label: 'Utilities', color: '#22c55e' },
  { value: 'software_saas', label: 'Software / SaaS', color: '#0ea5e9' },
  { value: 'professional_services', label: 'Professional Services', color: '#8b5cf6' },
  { value: 'rent', label: 'Rent', color: '#a78bfa' },
  { value: 'legal', label: 'Legal', color: '#f472b6' },
  { value: 'training', label: 'Training', color: '#60a5fa' },
  { value: 'r_and_d', label: 'R&D', color: '#34d399' },
  { value: 'equipment_capex', label: 'Equipment / CapEx', color: '#f97316' },
  { value: 'taxes', label: 'Taxes', color: '#84cc16' },
  { value: 'fees_bank_charges', label: 'Fees & Bank Charges', color: '#facc15' },
  { value: 'philanthropy', label: 'Philanthropy', color: '#c084fc' },
  { value: 'grants_out', label: 'Grants Out', color: '#22d3ee' },
  { value: 'other_expense', label: 'Other Expense', color: '#6b7280' }
];

export function resolveTypeColor(name) {
  const t = [...INFLOW_TYPES, ...EXPENSE_TYPES, ...CATEGORIES].find((x) => x.value === name);
  return t?.color || '#6b7280';
}
