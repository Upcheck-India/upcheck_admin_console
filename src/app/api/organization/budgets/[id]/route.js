import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { FinanceError } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString } from '../../../../../lib/finance/auth';
import { fromMinor, readMinor } from '../../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';
import {
  BUDGET_SCOPE_TYPES,
  BUDGET_TYPES,
  BUDGET_WORKFLOW_STATUSES,
  BUDGET_WORKFLOW_TRANSITIONS,
  normalizeBudgetCategories,
  computeAccountActuals,
  enrichBudgetWithActuals,
  normalizeFiscalYear,
} from '../_shared';

// Fields that change the budget's content (as opposed to its lifecycle).
// Content edits are only allowed while the budget is in draft/submitted.
const CONTENT_FIELDS = ['name', 'fiscalYear', 'fiscalYearStart', 'type', 'budgetType', 'categories', 'linkedGrants', 'notes'];

export async function GET(request, { params }) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const item = await db.collection('budgets').findOne({ _id: new ObjectId(id) });
    if (!item || item.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Budget-vs-actual detail: join category allocations to real ledger outflow.
    const actualsMap = await computeAccountActuals(db, item.accountId);
    return NextResponse.json(enrichBudgetWithActuals(item, actualsMap));
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/budgets/[id] error', e);
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('budgets');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ error: 'Budget has been deleted' }, { status: 409 });

    const body = await request.json();
    // NOTE: client-supplied `updatedBy` is intentionally ignored — the actor is
    // recorded server-side. `baseAmount` is also ignored: it is a scope snapshot
    // seeded once at creation (e.g. the account balance for an `available`
    // budget) and must never be re-seeded/clobbered by an edit.
    const { name, fiscalYear, fiscalYearStart, type, budgetType, categories, linkedGrants, notes, workflowStatus } = body || {};

    // ---- Approval workflow (edit rules + transitions) ----
    const currentStatus = existing.workflowStatus || 'draft'; // legacy docs = draft
    const hasContentEdit = CONTENT_FIELDS.some((k) => body && body[k] !== undefined);
    if (hasContentEdit && (currentStatus === 'approved' || currentStatus === 'locked')) {
      return NextResponse.json(
        { error: `Budget is ${currentStatus} and its content cannot be edited. Reopen the budget to edit.` },
        { status: 409 }
      );
    }

    const update = { updatedAt: new Date(), updatedBy: actorFromUser(user) };
    const unset = {};
    let workflowFrom = null;
    let workflowTo = null;

    if (workflowStatus !== undefined) {
      if (!BUDGET_WORKFLOW_STATUSES.includes(workflowStatus)) {
        return NextResponse.json(
          { error: `workflowStatus must be one of ${BUDGET_WORKFLOW_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      if (workflowStatus !== currentStatus) { // same-status is an allowed no-op
        const allowed = BUDGET_WORKFLOW_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(workflowStatus)) {
          return NextResponse.json(
            { error: `Cannot move budget from '${currentStatus}' to '${workflowStatus}'. Allowed: ${allowed.join(', ') || 'none'}` },
            { status: 409 }
          );
        }
        workflowFrom = currentStatus;
        workflowTo = workflowStatus;
        update.workflowStatus = workflowStatus;
        const now = new Date();
        const actor = actorFromUser(user);
        if (workflowStatus === 'submitted') {
          update.submittedAt = now;
          update.submittedBy = actor;
        } else if (workflowStatus === 'approved') {
          if (currentStatus === 'submitted') {
            update.approvedAt = now;
            update.approvedBy = actor;
          } else {
            // unlock (locked → approved): approval stamps stay, lock stamps go
            unset.lockedAt = '';
            unset.lockedBy = '';
          }
        } else if (workflowStatus === 'locked') {
          update.lockedAt = now;
          update.lockedBy = actor;
        } else if (workflowStatus === 'draft') {
          // withdraw (submitted → draft) / reopen (approved → draft): clear stamps
          unset.submittedAt = '';
          unset.submittedBy = '';
          unset.approvedAt = '';
          unset.approvedBy = '';
        }
      }
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
      }
      update.name = capString(name, 200);
    }
    if (fiscalYear !== undefined || fiscalYearStart !== undefined) {
      // Structured FY: accept an int/'2025' or a 'FY2025-26' label; keep the
      // canonical label and the integer start year in sync.
      const fy = normalizeFiscalYear(
        fiscalYearStart != null && fiscalYearStart !== '' ? fiscalYearStart : fiscalYear
      );
      if (!fy.fiscalYear) return NextResponse.json({ error: 'fiscalYear must not be empty' }, { status: 400 });
      update.fiscalYear = fy.fiscalYear;
      update.fiscalYearStart = fy.fiscalYearStart;
    }
    if (type !== undefined) {
      if (!BUDGET_SCOPE_TYPES.includes(type)) {
        return NextResponse.json({ error: `type must be one of ${BUDGET_SCOPE_TYPES.join(', ')}` }, { status: 400 });
      }
      update.type = type;
    }
    if (budgetType !== undefined) {
      if (!BUDGET_TYPES.includes(budgetType)) {
        return NextResponse.json({ error: `budgetType must be one of ${BUDGET_TYPES.join(', ')}` }, { status: 400 });
      }
      update.budgetType = budgetType;
    }
    if (linkedGrants !== undefined) {
      if (!Array.isArray(linkedGrants)) {
        return NextResponse.json({ error: 'linkedGrants must be an array' }, { status: 400 });
      }
      update.linkedGrants = linkedGrants
        .filter((g) => typeof g === 'string')
        .map((g) => capString(g, 64))
        .slice(0, 100);
    }
    if (notes !== undefined) update.notes = capString(notes, 5000);

    if (categories !== undefined) {
      if (!Array.isArray(categories)) {
        return NextResponse.json({ error: 'categories must be an array' }, { status: 400 });
      }
      let normalized;
      try {
        normalized = normalizeBudgetCategories(categories); // numbers + paise, rejects negatives
        // Scope guard against the STORED snapshot (never the request body).
        const hasBase = existing.baseAmount != null || existing.baseAmountMinor != null;
        if (hasBase) {
          const baseMinor = readMinor(existing, 'baseAmount');
          if (normalized.totalMinor > baseMinor) {
            throw new FinanceError('Total allocated exceeds the scope amount (baseAmount)', 400);
          }
        }
      } catch (err) {
        if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
        throw err;
      }
      update.categories = normalized.list;
      update.totalAllocated = fromMinor(normalized.totalMinor);
      update.totalAllocatedMinor = normalized.totalMinor;
    }

    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: update, ...(Object.keys(unset).length ? { $unset: unset } : {}) }
    );
    const after = { ...existing, ...update };
    for (const k of Object.keys(unset)) delete after[k];
    await recordFinanceAudit(db, {
      action: 'budget.update', collection: 'budgets', documentId: id,
      actor: actorFromUser(user), before: existing, after,
      meta: {
        accountId: existing.accountId,
        totalAllocatedMinor: after.totalAllocatedMinor ?? null,
        workflowFrom,
        workflowTo,
      },
    });

    // Return the updated budget enriched with actuals so the UI can refresh
    // budget-vs-actual figures without a second request.
    const actualsMap = await computeAccountActuals(db, existing.accountId);
    return NextResponse.json(enrichBudgetWithActuals(after, actualsMap));
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('PUT /api/organization/budgets/[id] error', e);
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('budgets');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ success: true, id, alreadyDeleted: true });

    // Lifecycle rule: only draft/submitted budgets may be deleted.
    const status = existing.workflowStatus || 'draft';
    if (status === 'approved' || status === 'locked') {
      return NextResponse.json(
        { error: `Budget is ${status} and cannot be deleted. Reopen the budget first.` },
        { status: 409 }
      );
    }

    // Soft delete — the plan is retained (and hidden from lists) so budget
    // history is never silently destroyed. Recoverable; also audited.
    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { deletedAt: new Date(), deletedBy: actorFromUser(user) } }
    );
    await recordFinanceAudit(db, {
      action: 'budget.delete', collection: 'budgets', documentId: id,
      actor: actorFromUser(user), before: existing,
      meta: { accountId: existing.accountId ?? null },
    });

    return NextResponse.json({ success: true, id });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('DELETE /api/organization/budgets/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 });
  }
}
