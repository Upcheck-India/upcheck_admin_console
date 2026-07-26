# Finance Module — Remediation Task List

Companion to `FINANCE_MODULE_AUDIT.md`. Every audit finding (Critical → Low) is tracked below and mapped to a phase. IDs match the audit (C = Critical, H = High, M = Medium, L = Low).

Status legend: ☐ todo · ◐ in progress · ☑ done · ⊘ deferred/won't-do (with reason)

---

## Phase 0 — Stop the bleeding (integrity) — ✅ DONE

Goal: make money movement safe and the headline numbers correct. No schema migration required.

- ☑ **0.1 (C1) Atomic money moves.** `receive-from-account` and `transfer-to-account` now run their two-collection writes inside a MongoDB transaction via `withFinanceTransaction` (safe fallback to non-transactional execution on standalone/non–replica-set Mongo). Shared helper: `src/lib/finance/tx.js`.
- ☑ **0.2 (C2) Idempotent + race-safe transfer.** Per-operation `opId` idempotency key (generated client-side when the modal opens, replayed safely on retry/double-click). Read-modify-write replaced with atomic guarded decrement `findOneAndUpdate({ remainingAmount: { $gte: amt } }, { $inc })`. Unique sparse index on `org_funds.opId` added in `mongodb.js`.
- ☑ **0.3 (H1) Fixed `$push: { history }` corruption** → single-entry `$push: { history: entry }` inside the atomic update.
- ☑ **0.4 (H2) Cleanup is now non-destructive.** No deletes; never rewrites `remainingAmount` upward; only clamps invalid states (non-finite / negative / > amount) downward. Removed `removedZero`/`removedCleared`.
- ☑ **0.5 (C3) Cumulative "Current Balance."** `funds` GET returns an all-time, filter-independent `summary.balance` (period `received`/`spent` retained for the activity cards).
- ☑ **0.6 (C4) Scoped trends & runway.** `trendMatch` now includes `accountId` + `category`/`kind`/`inflowType`/`expenseType`/`search`; also fixed the mutating `setMonth(-12)`.
- ☑ **0.7 (partial C5 / M3) Validate `accountId`.** `assertAccountExists` enforced on funds POST and both money routes. Full per-account *ownership* authorization deferred to Phase 1 (H1.12) — see note below.
- ☑ **0.8 (M6) Escaped `$regex` search** in both `funds` (list + trends) and `untransferred` (list) routes via `escapeRegex`.
- ☑ **0.9 Verified** via `tsc --noEmit` (no type errors in finance files) + `eslint` (clean) on all edited files. NOTE: full `next build` / full-project `tsc` OOM in this environment during static-page generation — unrelated to these changes; per user instruction, local build skipped in favor of type-check + lint.

> Note on C5: these `finance_accounts` are billing/sub-accounts within a **single org**, and every admin legitimately manages all of them — so cross-account access is not a privilege boundary today. Phase 0 hardens *existence validation*; introducing real ownership/tenant scoping (and scoping PUT/DELETE by `accountId`) is a data-model change tracked in Phase 1 (H8).

---

## Phase 1 — Data-model correctness & integrity — ✅ DONE

- ☑ **1.1 (H5) Money as integer paise.** Dual-field strategy: canonical `amountMinor` (int paise) + rupee `amount` kept in sync via `moneyFields()` (`src/lib/finance/money.js`); aggregations legacy-tolerant via `minorExpr()`. `numberFmt` now en-IN with 2 fraction digits. Optional backfill: `scripts/migrate-finance-money.js` (dry-run default, `--commit` to apply) — recommended but not required for correctness.
- ☑ **1.2 (H3) Referential integrity + soft delete + reversal.** Account DELETE blocked (409 + count) when live `org_funds` reference it. Fund entries and pool docs soft-delete (`deletedAt`/`deletedBy`); every ledger aggregation excludes them. Pool delete posts a contra `in` entry for the unspent remainder back to the source account (opId `revpool:<id>`, tags `['transfer','reversal']`). Transfer-generated ledger rows are immutable via PUT/DELETE (409 — reverse instead).
- ☑ **1.3 (H3) Append-only audit log.** `finance_audit_log` via `recordFinanceAudit` (`src/lib/finance/audit.js`) on every finance mutation across funds, accounts, untransferred, budgets, grants, vendors, bills, cost centers, assets, compliance — with actor + before/after images; written in-transaction where a session exists.
- ☑ **1.4 (H4) Budget-vs-actual & variance.** Budgets are enriched (list + detail) with per-category and total `actual` / `remaining` / `variancePct` from account-scoped `org_funds` outflows grouped by `expenseType`; surfaced in `BudgetDetails` (tiles, allocated-vs-actual chart, category table) and on budget cards.
- ☑ **1.5 (M4) Budget validation & types.** `categories[].allocated` stored as Numbers + `allocatedMinor`; negatives rejected; totals validated against `baseAmount`; `type`/`budgetType` whitelisted on POST and PUT.
- ☑ **1.6 (M5) Available-budget snapshot fix.** `baseAmount` snapshot is seeded on CREATE only; PUT ignores client `baseAmount` entirely; UI no longer re-seeds it when editing and labels the stored snapshot.
- ☑ **1.7 (H7) Grant state machine.** Status whitelist + enforced transition map (400 invalid value / 409 illegal transition listing allowed targets); `untransferredId` + derived `receivedToOrg` are the single source of truth (legacy `transferred` mirror-written); summary count and money buckets now cover identical sets with `pending_transfer` split out explicitly.
- ☑ **1.8 (M1) Category taxonomy.** Funds POST defaults `category` to `inflowType`/`expenseType` (`'other'` last), so the category filter matches stored data.
- ☑ **1.9 (M2) Timezone correctness.** Query-time IST (`Asia/Kolkata`) via `src/lib/finance/dates.js`: `presetRange()` for preset boundaries, `groupIdForBucket()` adds `timezone` to `$year/$month/$isoWeek`; `setMonth(-12)` drift fixed; grant date off-by-one fixed with `formatBusinessDate`.
- ☑ **1.10 (M7) Bounded queries.** `parseLimit` (max + NaN guard) + skip + totalCount → `pagination` object on funds, budgets, grants, untransferred, vendors, bills, cost centers, assets, compliance.
- ☑ **1.11 (M8) Fund PUT hardening.** PUT requires `accountId` + `assertAccountExists`; 409 on soft-deleted or transfer rows; before/after audited.
- ◐ **1.12 (H8 / C5) Object-level authorization — decided & documented.** Billing accounts are sub-accounts of a **single org** and every admin legitimately manages all of them, so cross-account access is not a privilege boundary today. Existence validation enforced everywhere (`assertAccountExists`). Real tenancy/ownership scoping deferred until a multi-org or role-split requirement exists.
- ☑ **1.13 Security hardening.** Shared `requireFinanceAdmin` (`src/lib/finance/auth.js`) replaces the copy-pasted auth block: CSRF same-origin check on mutations, 2h absolute session age (via `admin_sessions.createdAt`), `capString`/`capTags` length caps, date validation, `escapeRegex` on all `$regex`. *Not done:* basic rate limiting — needs an infra decision (middleware/edge vs per-route), tracked as follow-up.
- ☑ **1.14 (H6) Correct runway.** Server-computed: cumulative balance ÷ avg burn over the last 3 complete IST months (`summary.avgMonthlyBurn`, `summary.runwayMonths`); client hook consumes the server value — no longer depends on display `groupBy` and never mixes accounts.

---

## Phase 2 — Close the ERP feature gaps

- ☑ **2.1 (H4→) Budget vs actual reporting UI.** Variance %, spent/remaining progress bars (red when over) on budget cards; allocated-vs-actual chart + per-category variance table in `BudgetDetails` (incl. categories with spend but zero allocation).
- ☑ **2.2 Real Financial Reports.** New `GET /api/organization/reports` + `/organization/finance/reports` page: P&L (income by `inflowType`, expenses by `expenseType`, net surplus/deficit), monthly cashflow (IST buckets, chart + table), fund utilization; `excludeTransfers` default on; CSV export + print. Finance-hub card enabled. (fixes L1 together with X.6)
- ☑ **2.3 Fund-accounting reporting.** Restricted vs unrestricted received/spent/balance in the reports module via `fundRestriction` (absent/null → unrestricted legacy default); restriction preserved through fund PUT hardening. Note: expense entries don't carry `fundRestriction` today, so spend reports as unrestricted — per-expense restriction tagging is a future enhancement.
- ☑ **2.4 Accounts Payable.** `vendors` + `vendor_bills` collections, full CRUD APIs, and `/organization/vendors` module UI (vendor directory + bills with status workflow draft→approved→paid/cancelled). Payment posts an `org_funds` outflow (`reference: vendorbill:<id>`, tags `['ap']`) inside a transaction with opId idempotency and atomic status claim; vendor soft-delete blocked (409) with outstanding bills; AP summary (outstanding / overdue / paid this month).
- ☑ **2.5 Cost Centers.** `cost_centers` master (unique code) + `/organization/cost-centers` UI; spend rollup from `org_funds.allocations[]` (string-amount tolerant via `$convert`), matched against center code and name, with budget-vs-actual bars and an "Unassigned cost-center spend" section for unmatched allocation keys.
- ☑ **2.6 Fixed Assets & depreciation.** `fixed_assets` registry + `/organization/assets` UI: straight-line depreciation in integer paise (final month absorbs rounding so NBV lands exactly on salvage), month-by-month schedule per asset, portfolio totals, dispose flow vs soft delete, disposed-asset edit locking.
- ☑ **2.7 Compliance calendar.** `compliance_items` + `/organization/compliance` UI: GST/TDS/IT/ROC/FCRA/PF/ESI types, overdue derived at read time (never stored), atomic mark-filed that rolls the next occurrence for recurring items (calendar-month add with day clamping), attachments, buckets + summary counts.
- ◐ **2.8 Nonprofit/India compliance — partial.** Covered: FCRA/80G/GST/TDS filing deadlines via the compliance calendar; restricted-fund (FCRA-style) segregation reporting via 2.3. Deferred: 80G donation receipt generation and donor/funder utilization statements — need org registration details (80G number, signatory, receipt numbering scheme) before building.
- ☑ **2.9 Grant lifecycle depth.** Attachments (sanitized, http(s)-only URLs) and milestones (server-stamped `doneAt`, pending/done) on grant applications; read-time deadline reminders (application deadlines + pending milestone due dates, IST day boundaries, account-wide — not per-page) surfaced as a red/amber banner, with overdue-milestone badges on rows and full sections in the details modal.
- ◐ **2.10 Approval workflow — budget lifecycle DONE.** Budget `draft→submitted→approved→locked` enforced server-side (400 invalid / 409 illegal transition listing allowed targets), server-stamped submitted/approved/locked by+at, content edits and delete 409 on approved/locked ("Reopen the budget to edit"), full audit with workflowFrom/To, per-state UI actions. Deferred: maker-checker on money moves / segregation of duties — requires a role split beyond the current "all admins equal" model (same rationale as 1.12).
- ☑ **2.11 Multi-year budgeting.** Structured `fiscalYearStart` (int) + canonical India label `FY2025-26` kept in sync (accepts int/`2025`/`FY2025`/`2025-26`/`FY2025-26`; legacy free-text tolerated); carryforward creates a new budget from a source budget's per-category remaining (allocated − actual, floored, integer paise) with `carriedForwardFrom` provenance; FY filter + FY-aware sort in list and UI.
- ⊘ **2.12 Multi-currency + FX — deferred.** Org operates in INR only (foreign grants land in INR at the bank); the paise ledger assumes a single currency. Revisit only if a genuine foreign-currency account/entry need appears.

---

## Phase 3 — Accounting foundation (structural, longer-term)

- ☐ **3.1 Double-entry general ledger** with a chart of accounts (asset/liability/equity/income/expense) and journal entries/posting.
- ☐ **3.2 Persisted balances + fiscal periods + period close / year-end lock** (immutable posted transactions; reversals via contra entries only).
- ☐ **3.3 Bank reconciliation / statement import.**
- ☐ **3.4 Tax handling** (GST/TDS/VAT) with proper journal treatment; accruals; depreciation schedules.
- ☐ **3.5 AR / invoicing / receipts; payroll / stipends** as needed.

---

## Cleanups — ✅ DONE

- ☑ **X.1 (L3)** Dead `BudgetPlanning.js` deleted; verified zero remaining imports/references across `src/` (`page.js` uses only `BudgetPlanningEnhanced`).
- ☑ **X.2 (L4)** All dynamic `bg-${color}-...` badge classes replaced with static class maps (grants, and every new module was built static-only).
- ☑ **X.3 (L5)** All `.toLocaleString()` money renders guarded (`(x || 0)`) and given `'en-IN'`; new code uses shared `numberFmt`.
- ☑ **X.4 (L2)** Untransferred summary total now sums `remaining` (paise-exact), not original `amount`.
- ☑ **X.5 (L6)** `createdBy`/`updatedBy` recorded server-side via `actorFromUser` everywhere; client-supplied values ignored; grant PUT stamps it too.
- ☑ **X.6 (L1)** Finance-hub Quick Stats replaced with live data from the funds summary API for the active account (balance, received this year, avg monthly burn, server-computed runway); Cost Centers/Reports cards enabled and Vendors/Assets/Compliance cards added.
