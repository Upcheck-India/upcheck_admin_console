# Finance Module — Audit Report

**Project:** upcheck_admin (ERP / organization admin portal)
**Module audited:** Organization → Finance (Funds, Accounts, Budgets, Grants, Untransferred, and the finance‑adjacent Vendors / Assets / Compliance surfaces)
**Date:** 2026‑07‑22
**Stack:** Next.js 15 (App Router) · React 19 · MongoDB (raw driver, `resources` DB) · cookie/session auth (`admin_token` → `admin_users.sessionToken`)
**Context:** Nonprofit / NGO fund‑tracking for an India‑based org (grants, donations, restricted/unrestricted funds, "runway"; all amounts in ₹).

---

## 1. Executive summary

The finance area is best described as a **fund‑tracking and grant‑pipeline tool**, not a finance/accounting module. Roughly **40% of what the UI advertises is real**; the rest are placeholder cards. Of the parts that are real, the money‑movement logic has **critical integrity defects** — non‑atomic transfers, a history‑corrupting database write, race conditions that can create or destroy money, hard deletes with no audit trail, and a headline "balance" figure that is not actually a balance.

**Verdict:** Not safe to rely on as a book of record in its current state. It is usable as an informal tracker, but the numbers it reports can silently drift from reality, and several operations can lose or double‑count funds under normal use (double‑clicks, concurrent admins, partial failures).

### Severity snapshot

| Severity | Count | Examples |
|---|---|---|
| 🔴 Critical | 5 | Non‑atomic money moves; transfer race → double‑credit; "balance" is only current‑year cashflow; trends/runway bleed across all accounts; cross‑account IDOR |
| 🟠 High | 7 | `$push` history corruption; cleanup deletes records + resurrects money; account/entry delete orphans data; no budget‑vs‑actual; money stored as floats |
| 🟡 Medium | 8 | Dead category filter; timezone/date boundary bugs; no over‑draw checks; grant status has no state machine; ReDoS via unescaped `$regex`; row‑count vs summary mismatch |
| ⚪ Low / UX | 6 | Hard‑coded fake dashboard KPIs; unassigned total overstated; dead `BudgetPlanning.js`; Tailwind dynamic classes purged; unbounded queries |

### The single most important thing to fix
The **money‑movement path** (`untransferred/receive-from-account` and `transfer-to-account`) writes two documents with **no MongoDB transaction, no atomic guard, and no idempotency key**, and corrupts its own audit history with a misused `$push`. This is where funds are actually created and destroyed on the books, and it is the least safe code in the module.

---

## 2. Scope & method

Files reviewed in full (13 API routes + all finance pages/components/hooks):

- **Accounts:** `src/app/api/organization/accounts/route.js`, `accounts/[id]/route.js`, `src/app/organization/finance/accounts/page.js`
- **Funds ledger:** `src/app/api/organization/funds/route.js`, `funds/[id]/route.js`, `src/app/organization/funds/**` (page, `_components/*`, `_hooks/*`)
- **Budgets & grants:** `budgets/route.js`, `budgets/[id]/route.js`, `grant-applications/route.js`, `grant-applications/[id]/route.js`, `src/app/organization/planning-budgets/**`
- **Untransferred pool:** `untransferred/route.js`, `untransferred/[id]/route.js`, `untransferred/[id]/transfer-to-account/route.js`, `untransferred/receive-from-account/route.js`, `untransferred/cleanup/route.js`, `src/app/organization/untransferred/page.js`
- **Finance hub & adjacent:** `src/app/organization/finance/page.js`, `organization/page.js`, `organization/vendors/page.js`, `organization/assets/page.js`, `organization/compliance/page.js`

Collections in play: `finance_accounts`, `org_funds`, `budgets`, `grant_applications`, `org_untransferred` (+ `admin_users` for auth).

---

## 3. What exists today (implemented inventory)

| Area | Backend | UI | State |
|---|---|---|---|
| **Billing accounts** (`finance_accounts`) | CRUD | ✅ | Real, but "account" = `{ name }` only — no type, currency, or balance field |
| **Funds ledger** (`org_funds`) | CRUD + aggregations | ✅ | Real. Single‑sided in/out entries; filters, category/time analytics, CSV/Excel/PDF export |
| **Untransferred pool** (`org_untransferred`) | receive / transfer / cleanup / delete | ✅ | Real. Manual "holding pool" for received‑but‑unassigned money |
| **Budgets** (`budgets`) | CRUD | ✅ | Real allocations, but **allocation‑only** (no actuals/variance) |
| **Grant applications** (`grant_applications`) | CRUD + summary | ✅ | Real 6‑stage pipeline + "mark received" flow |
| **Cost Centers** | ❌ none | card `href:'#'` | Stub ("Coming Soon") |
| **Financial Reports** | ❌ none | card `href:'#'` | Stub ("Coming Soon") |
| **Vendors & Contracts** | ❌ none | placeholder page | UI‑only stub |
| **Assets & Inventory** | ❌ none | placeholder page | UI‑only stub |
| **Compliance Calendar** | ❌ none | placeholder page | UI‑only stub |

**Finance hub headline KPIs are fake.** `src/app/organization/finance/page.js:141‑174` renders "Total Budget ₹12.5L", "Monthly Spend ₹2.3L", "Runway 18 months", "8 Categories" with "+12% / ‑5%" deltas as **hard‑coded string literals**, presented identically to live data.

---

## 4. Reference: what a fully‑functional ERP finance module needs

Researched against standard ERP finance scope and adapted to this org's **nonprofit / India** context. Legend: ✅ present · ◑ partial · ❌ absent.

### 4.1 Core accounting (the foundation — currently absent)
| Capability | Status | Notes |
|---|---|---|
| Double‑entry general ledger (debits = credits) | ❌ | Entries are single‑sided `in`/`out`; "transfers" are one‑sided flags |
| Chart of accounts (asset/liability/equity/income/expense) | ❌ | "Accounts" are name‑only buckets |
| Journal entries / posting | ❌ | Direct inserts; no posting concept |
| **Stored, persisted balances** | ❌ | Balance recomputed live from a mutable, deletable collection |
| Immutable, append‑only audit trail | ❌ | Hard deletes; mutable `history`; `createdBy` kept but prior values discarded |
| Fiscal periods / period close / year‑end lock | ❌ | Nothing prevents editing historical data |
| Opening balances / carryforward | ❌ | No opening balance concept |
| Multi‑currency + FX | ❌ | ₹ hard‑coded throughout |
| Money stored as integer minor units / Decimal128 | ❌ | Stored as JS floats |
| Bank reconciliation / statement import | ❌ | — |

### 4.2 Transactional modules
| Capability | Status | Notes |
|---|---|---|
| Cash/fund tracking (in/out) | ◑ | Exists as `org_funds`, but not ledger‑grade |
| Accounts Payable (vendors, bills, payments) | ❌ | No vendor entity; outflows have free‑text `counterparty` only |
| Accounts Receivable (customers, invoices) | ❌ | — |
| Expense management (claims, receipts, approvals) | ❌ | No receipts/attachments/approvals |
| Purchase orders / commitments (encumbrance) | ❌ | — |
| Payroll / stipends | ❌ | — |
| Fixed assets + depreciation | ❌ | Assets page is a stub |

### 4.3 Planning, control & reporting
| Capability | Status | Notes |
|---|---|---|
| Budget creation & allocation | ✅ | `budgets` module |
| **Budget vs. actual / variance** | ❌ | Budgets never join to `org_funds` actuals |
| Encumbrance / commitment control | ❌ | — |
| Budget approval workflow (draft→approved→locked) | ❌ | Budgets have no status field |
| Multi‑year budgeting / phasing | ❌ | `fiscalYear` is free‑text; `monthly` type is cosmetic |
| Cost centers / departments / projects | ◑ | `allocations[]` field exists on entries; no cost‑center master, card is dead |
| Financial statements (Trial Balance, P&L, Balance Sheet, Cash Flow) | ❌ | "Financial Reports" card disabled |
| Scheduled/parameterized reports & exports | ◑ | Ad‑hoc CSV/Excel/PDF on the funds page only |
| Dashboards from real data | ◑ | Funds page real; finance hub KPIs fake |

### 4.4 Nonprofit / India‑specific (high relevance here)
| Capability | Status | Notes |
|---|---|---|
| Fund accounting: restricted vs. unrestricted | ◑ | `fundRestriction` field captured but never enforced or reported on |
| Grant/donor lifecycle management | ◑ | Grant pipeline exists; no documents, milestones, or reporting requirements |
| Donation receipts (80G) | ❌ | — |
| FCRA (foreign contribution) segregation & reporting | ❌ | No separation of foreign funds |
| Statutory compliance (GST, TDS, IT filings, ROC/FCRA returns) | ❌ | Compliance page is a stub |
| Donor / funder statements & utilization reports | ❌ | — |

### 4.5 Platform & governance
| Capability | Status | Notes |
|---|---|---|
| Role‑based access (view/post/approve segregation of duties) | ◑ | Only a single coarse "admin" role; no maker‑checker |
| Object‑level / multi‑account authorization | ❌ | Any admin can touch any account's data (IDOR) |
| Transactional integrity (ACID for money moves) | ❌ | No DB transactions anywhere in the module |
| Idempotency on money operations | ❌ | Double‑submit = double effect |
| Full audit log (who/when/before/after) | ❌ | — |
| Attachments (invoices, receipts, grant agreements) | ❌ | — |
| CSRF protection / rate limiting on mutations | ❌ | Cookie‑auth mutations, no CSRF token/Origin check |

---

## 5. Defects — what is incorrect or broken

Ranked by severity. Each item lists the location and a concrete failure scenario.

### 🔴 Critical

**C1 — Money movement is not atomic (no transactions anywhere).**
`untransferred/receive-from-account/route.js` (insert ledger `out` at ~:62, then insert pool doc at ~:80) and `transfer-to-account/route.js` (insert ledger `in` :74, then decrement `remainingAmount` :86) perform **two independent writes with no MongoDB session/transaction**. A grep for `startSession`/`withTransaction` across the whole `organization` API returns nothing.
*Failure:* if the second write throws, **receive** leaves an account debited with no pool entry (money lost from the books); **transfer** leaves an account credited while the pool still shows the money as remaining (money double‑counted). The variables `sessionClient`/`sessionDb` in `transfer-to-account` are misleadingly named — no session is opened.

**C2 — Transfer is non‑idempotent + read‑modify‑write race → double credit.**
`transfer-to-account/route.js:44‑88` reads `remaining`, checks `amt > remaining` (:47), inserts an `in` ledger entry (:74), then `$set remainingAmount = remaining - amt` (:88) using the stale read.
*Failure:* a double‑click or two concurrent admins both pass the check, both insert an `in` entry, and both `$set` the same decremented value → **money credited twice, pool decremented once.** The `isSaving` guard is client‑side only. Fix pattern: atomic conditional `updateOne({ _id, remainingAmount: { $gte: amt } }, { $inc: { remainingAmount: -amt } })` and only post the ledger entry when `modifiedCount === 1`.

**C3 — "Current Balance" is not a balance; it is current‑year net cashflow.**
`funds/route.js:134‑141` computes `summary` using the **same `filter` as the transaction list**, which includes the date range. The client defaults `datePreset: 'thisYear'` (`useFundsData.js:12`).
*Failure:* the balance card (`SummaryCards.js:32`) shows only *received − spent for the current calendar year*; **on Jan 1 every account's balance visually resets to ~0**, and applying any category/kind/search filter mutates the "balance." There is no cumulative/opening‑balance concept.

**C4 — Trends & runway aggregate across ALL accounts and ignore filters (cross‑account data bleed).**
`funds/route.js:160‑167` builds `trendMatch` as only `{ isTransfer? } + date`, **omitting `accountId`, `category`, `kind`, `search`**. So `timeTrends`/`monthlyTrends` sum the entire `org_funds` collection while `summary`/`categoryBreakdown` are per‑account.
*Failure:* the monthly trend chart, sparkline, and runway for Account A silently include Account B's data — both wrong numbers and information leakage between accounts.

**C5 — Cross‑account IDOR (no object‑level authorization).**
`accountId` is a client‑supplied string used directly in filters with no ownership check (`budgets/route.js:43`, `grant-applications/route.js:42`, `funds/route.js`). `PUT`/`DELETE` on budgets and grants match on `_id` **only**, with no `accountId` in the filter (`budgets/[id]/route.js:67`, `grant-applications/[id]/route.js:84`).
*Failure:* any Admin/Console‑admin can read, edit, or delete **any** account's budgets, grants, and transactions by passing a different id. Role‑gating exists; per‑account/tenant isolation does not.

### 🟠 High

**H1 — `$push` of the whole history array corrupts the audit trail.**
`transfer-to-account/route.js:77‑89`: builds `const history = item.history || []; history.push(entry)` then writes `$push: { history }`.
*Failure:* `$push` appends the **entire array as one nested element**, producing `history: [ [ …entries ] ]`. History renders break (`untransferred/page.js:433‑442`), and the nested entries fail the `typeof amount === 'number'` filter in cleanup, poisoning the recompute (see H2). Should be `$push: { history: entry }` or `$set: { history }`.

**H2 — Cleanup route destroys records and can resurrect money.**
`untransferred/cleanup/route.js`: hard‑deletes every entry with `remaining === 0` (:69‑73), erasing the audit trail of fully‑transferred funds; and recomputes `remainingAmount` from the (H1‑corrupted) history (:42‑54), so real transfers get dropped from the `transferred` sum and `remainingAmount` is rewritten **upward** — putting already‑transferred money back into the pool while the `in` ledger entries still exist. Exposed to all admins via an always‑on button (`untransferred/page.js:78 SHOW_CLEANUP_BUTTON = true`).

**H3 — Deletes orphan financial data (no referential integrity, no reversal).**
Deleting an account (`accounts/[id]/route.js:65`) does not touch its `org_funds` transactions → orphaned, unattributable entries (UI only blocks deleting the *active* account, client‑side). Deleting a fund entry (`funds/[id]/route.js:127`) and deleting a pool doc (`untransferred/[id]/route.js`) are hard deletes with no compensating/contra entry — deleting a transfer's `in` entry, or a pool doc with `remaining > 0`, silently drifts balances with no way to reconcile.

**H4 — Budget‑vs‑actual is entirely absent.**
`budgets` store only `allocated`; no `spent`/`actual`/`encumbered` field and no code path joins to `org_funds` (which holds real category‑level spend). `BudgetDetails.js` shows "Total Allocated" only. The `type:'actual'` label is cosmetic. Result: budgets cannot show consumption, remaining, or variance, and cannot prevent overspend.

**H5 — Money stored as floats, with display that hides the drift.**
All amounts are `Number()` JS doubles (`funds/route.js:212`, `budgets/route.js:94`, grant amounts, `remainingAmount` maintained by float subtraction). `numberFmt` uses `maximumFractionDigits: 0` (`constants.js:16`), so ₹100.50 renders "₹101/₹100" — **rounding error is invisible in the UI while stored/summed values diverge**, and equality checks in cleanup (`remaining === 0`) become unreliable. Store integer paise or Decimal128.

**H6 — Runway math is mislabeled and built on broken inputs.**
`useFundsData.js:156‑163`: `runway = floor(summary.balance / avgBurn)` where `avgBurn` is the mean of the last 3 `monthlyTrends` out‑buckets — but those buckets follow `groupBy` (can be day/week/year), and it consumes the wrong `summary.balance` (C3) and cross‑account trends (C4). The UI hard‑labels it "months." With `groupBy:'day'` it's balance ÷ daily spend labeled as months. It also treats non‑contiguous months (zero‑spend months have no doc) as consecutive.

**H7 — Grant bookkeeping has two conflicting flag systems and no state machine.**
`transferred`/`transferredToFundId` vs `receivedToOrg`/`untransferredId` are unenforced parallel flags; the "mark received" flow sets one set and never the other (`GrantApplications.js:157`). `summary.granted` count excludes `pending_transfer` but `summary.totalGranted` money includes it (`grant-applications/route.js:56,59`) — count and amount disagree. Status is written with no enum whitelist (`[id]/route.js:68`), so any string is accepted and silently breaks summary filters/UI.

### 🟡 Medium

- **M1 — Category filter is dead for all new data.** New funds always store `category:'other'` (client never sends `category`; `funds/route.js:226`), but `FiltersPanel` filters on `category` using grant/donation/… values → matches nothing.
- **M2 — Timezone / date‑boundary bugs.** Presets use server‑local date constructors (`funds/route.js:59‑70`); stored dates are UTC‑midnight from `YYYY‑MM‑DD`; trend grouping uses `$year/$month/$isoWeek` with no timezone. For IST users, entries fall in the wrong day/month at boundaries. `setMonth(now.getMonth()-12)` (:166) also drifts on month length. Grant dates render off‑by‑one via `new Date(str).toLocaleDateString()`.
- **M3 — No over‑draw / existence checks on money moves.** `receive-from-account` validates only `amt > 0`; never checks the source account holds `amt`, never validates `accountId` exists in `finance_accounts`. Balances can go arbitrarily negative; entries can be attributed to non‑existent accounts.
- **M4 — No allocation‑vs‑scope validation in budgets.** `totalAllocated` can exceed `baseAmount`, linked‑grants total, or account balance; nothing rejects it. Negative allocations flow through. Category `allocated` is persisted as a **string** (UI writes `e.target.value`), forcing every consumer to defensively `Number()`.
- **M5 — `available` budget stores a stale snapshot and clobbers on edit.** `baseAmount` frozen at creation; opening an existing `available` budget overwrites the stored value with the current live balance (`BudgetPlanningEnhanced.js:77‑95`), discarding the persisted figure.
- **M6 — ReDoS / regex injection.** `search` is passed unescaped into `$regex` (`funds/route.js:120`, `untransferred/route.js:39`). Admin‑only, but a crafted pattern causes catastrophic backtracking.
- **M7 — Table vs. summary mismatch; unbounded queries.** `items` capped at `limit` (default 500, no max, `parseInt` → `NaN` on junk) while `summary`/`categoryBreakdown` are uncapped; client‑side TopLists/QuickStats disagree with summary cards past 500 rows. `budgets`/`grant-applications`/`accounts` list queries are unbounded (`find().toArray()`).
- **M8 — PUT can null/relocate a transaction's account.** `funds/[id]/route.js` sets `accountId: accountId || null` without requiring it — editing an entry with a missing account nulls it out of every view; account can be changed to any arbitrary id with no check.

### ⚪ Low / UX

- **L1 — Fake dashboard KPIs.** `finance/page.js:141‑174` hard‑coded literals presented as live data.
- **L2 — "Total Received (Unassigned)" overstated.** `untransferred/route.js:58‑63` adds full original `amount` for partially‑transferred items instead of `remaining`.
- **L3 — Dead code.** `BudgetPlanning.js` is never imported (page uses `BudgetPlanningEnhanced`), and it targets an older 2‑type model that would post invalid payloads. Safe to delete.
- **L4 — Tailwind dynamic classes purged.** `bg-${statusDef.color}-50` (`GrantApplications.js:253`, `GrantApplicationDetails.js:17`) is stripped in production unless safelisted → unstyled status badges.
- **L5 — Render fragility.** `amount.toLocaleString()` assumes a present number; any legacy doc missing `amount` crashes the row/modal.
- **L6 — Spoofable / missing audit fields.** Budget `updatedBy` is taken from the client body (`budgets/[id]/route.js:40`); grant PUT records no `updatedBy` at all.

---

## 6. Security & authorization summary

- **Role‑gating is consistent** — all 13 finance routes enforce `admin_token` session + `role ∈ {Admin, Console admin}`. No route is missing authentication.
- **But object‑level authorization is absent** (C5): a single coarse admin role, no per‑account/tenant scoping, no segregation of duties (no maker‑checker / approval separation). Any admin can do anything to any account's data.
- **No CSRF protection** on cookie‑authenticated POST/PUT/DELETE; no `Origin`/`Referer` check, no CSRF token. Depends entirely on the `admin_token` cookie's SameSite setting (defined elsewhere).
- **Session lookup has no expiry/revocation check** in these handlers — a leaked `sessionToken` is valid indefinitely here.
- **Input hardening gaps:** unescaped `$regex` (ReDoS), unbounded `limit`, no length caps on `title`/`notes`/`tags`, `accountId` never validated, `date` accepts Invalid Date, budget `status`/`budgetType` written without enum checks.
- **The auth block is copy‑pasted into all 13 route files** (no shared middleware) — a consistency/maintenance risk when policies change.

---

## 7. Prioritized remediation roadmap

### Phase 0 — Stop the bleeding (integrity, days)
1. Wrap every money move (`receive-from-account`, `transfer-to-account`) in a **MongoDB transaction**; make the pool decrement an **atomic conditional `$inc`**; add an **idempotency key** per operation (C1, C2).
2. Fix the `$push: { history }` corruption → `$push: { history: entry }` (H1), and **stop cleanup from hard‑deleting** records / rewriting balances upward (H2).
3. Make **"Current Balance" cumulative** (compute over all‑time, independent of the display date filter) and **scope trends/runway to `accountId` + active filters** (C3, C4).
4. Enforce **per‑account authorization** on every route and add `accountId` to `PUT`/`DELETE` filters (C5).

### Phase 1 — Data model correctness (weeks)
5. Store money as **integer paise (or Decimal128)** end‑to‑end; drop `maximumFractionDigits: 0` masking (H5).
6. Add **referential integrity / soft‑delete + reversal**: block or cascade account/entry deletes; replace hard deletes with reversing (contra) entries and an **append‑only audit log** (H3).
7. Persist `budgets.categories[].allocated` as **numbers**; add scope validation; validate/whitelist `status` and `budgetType`; unify grant transfer/received flags into one **state machine** (M4, H7).
8. Fix category taxonomy so the **filter matches stored data** (M1); fix timezone handling with a consistent tz for presets, storage, and grouping (M2).
9. Add existence/over‑draw checks, query bounds, length caps, and `$regex` escaping (M3, M6, M7).

### Phase 2 — Close the ERP gaps (months, prioritized for this org)
10. **Budget vs. actual & variance** by joining budget categories to `org_funds` (H4) — highest‑value reporting win.
11. **Real Financial Reports** (P&L / fund‑utilization / cash‑flow) to replace the disabled card and the fake KPIs (L1).
12. **Fund‑accounting enforcement** (restricted vs. unrestricted balances and reporting) — already modeled via `fundRestriction`, just unused.
13. **Vendors → AP** (vendor master + bills + payments linked to outflows) and **cost centers** to back the dead cards.
14. Nonprofit/India compliance: **80G receipts, FCRA segregation, GST/TDS + statutory calendar** (Compliance page).
15. Longer‑term foundation: a **double‑entry ledger with a chart of accounts, fiscal periods, and period close** — the structural prerequisite for the module to be a book of record.

---

## 8. Appendix — module reality map

**Real & backed:** Accounts · Funds ledger · Untransferred pool · Budgets · Grant applications
**Advertised but empty:** Cost Centers · Financial Reports · Vendors & Contracts · Assets & Inventory · Compliance Calendar
**Presented as real but fabricated:** Finance‑hub Quick Stats (Total Budget / Monthly Spend / Runway / Categories)

**Internal integrations that do work:** grants ↔ untransferred (`untransferredId`/`relatedApplicationId`), untransferred ↔ funds (transfer creates `isTransfer` rows), budgets ↔ grants (`linkedGrants`). All are self‑contained to the fund‑tracking subsystem and none connect to a general ledger.
