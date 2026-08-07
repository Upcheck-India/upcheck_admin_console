// src/lib/oauth/scopes.js
//
// The scope catalogue for "Upcheck ERP Data OAuth" — the single source of truth
// for what a connected app may read. Phase 1 exposes read-only, non-sensitive HR
// data only. Every scope is `<domain>.<resource>:read`; there is no write scope.
//
// This module is intentionally DEPENDENCY-FREE (pure JS, no mongodb / next
// imports) so it can be imported by client components (the register form and the
// consent screen) as well as server routes — one catalogue, no drift.

export const API_VERSION = 'v1';

// Ordered so the consent screen and docs render predictably.
export const SCOPES = [
  {
    id: 'hr.employees:read',
    label: 'Employee directory',
    resource: 'HR',
    description:
      'Read the staff directory: name, work email, role, department, job title, employment type & status, manager, start/end dates, location, timezone, avatar.',
    // Fields intentionally excluded are documented in resource.js; no PII,
    // government IDs, bank details, personal contact info or salary are included
    // in this scope. Salary is available separately via hr.compensation:read.
  },
  {
    id: 'hr.people:read',
    label: 'People roster',
    resource: 'HR',
    description:
      'Read the people/roster records: employee ID (e.g. UTEMP-00001), type (employee/intern/contractor), status, department, job title, manager and join date.',
  },
  {
    id: 'hr.departments:read',
    label: 'Departments & org structure',
    resource: 'HR',
    description:
      'Read the list of departments and headcount — safe org-structure data for building org charts and directories.',
  },
  {
    id: 'hr.calendar:read',
    label: 'Holidays & leave types',
    resource: 'HR',
    description:
      'Read the holiday calendar and the leave-type catalogue (org-wide reference/config data). No individual leave records.',
  },
  {
    id: 'hr.compensation:read',
    label: 'Compensation (salary)',
    resource: 'HR',
    sensitive: true,
    description:
      'Read employee compensation: salary / CTC amount, currency, pay frequency and effective date. SENSITIVE — grant only to apps that genuinely need payroll data. Served only via the dedicated compensation endpoint.',
  },
];

const SCOPE_IDS = new Set(SCOPES.map((s) => s.id));
const SCOPE_BY_ID = new Map(SCOPES.map((s) => [s.id, s]));

export function isKnownScope(id) {
  return SCOPE_IDS.has(id);
}

export function getScope(id) {
  return SCOPE_BY_ID.get(id) || null;
}

// Scopes flagged sensitive get an extra warning on the consent screen and in the
// registration UI so an admin never grants payroll access by reflex.
export function isSensitiveScope(id) {
  const s = SCOPE_BY_ID.get(id);
  return !!(s && s.sensitive);
}

export function allScopeIds() {
  return SCOPES.map((s) => s.id);
}

/**
 * Parse a space-delimited scope string (OAuth wire format) into a de-duped,
 * ordered array of KNOWN scope ids. Unknown scopes are dropped by default;
 * pass { strict:true } to instead collect them for an invalid_scope error.
 * Returns { scopes, unknown }.
 */
export function parseScopeString(raw) {
  const unknown = [];
  const scopes = [];
  const seen = new Set();
  if (typeof raw !== 'string') return { scopes, unknown };
  for (const tok of raw.split(/\s+/)) {
    const s = tok.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    if (SCOPE_IDS.has(s)) scopes.push(s);
    else unknown.push(s);
  }
  return { scopes, unknown };
}

/** Sanitise an array of requested scope ids down to the known, allowed set. */
export function normalizeScopes(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  for (const s of input) {
    if (typeof s !== 'string') continue;
    const v = s.trim();
    if (!v || seen.has(v) || !SCOPE_IDS.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * Intersect requested scopes with what a client is allowed to hold. Order
 * follows the requested list. Used at the /authorize step so an app can never
 * be granted more than it was registered for.
 */
export function grantableScopes(requested, allowed) {
  const allowSet = new Set(allowed || []);
  return normalizeScopes(requested).filter((s) => allowSet.has(s));
}

/** True when the token's granted scopes satisfy the required scope. */
export function scopesSatisfy(granted, required) {
  return Array.isArray(granted) && granted.includes(required);
}

export function scopeToWire(scopes) {
  return (scopes || []).join(' ');
}
