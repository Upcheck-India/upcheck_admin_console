import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../lib/mongodb';
import { FinanceError } from '../../../../lib/finance/tx';
import { requireFinanceAdmin, capString, parseLimit } from '../../../../lib/finance/auth';
import { toMinor, fromMinor, readMinor } from '../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../lib/finance/audit';
import {
  BUDGET_SCOPE_TYPES,
  BUDGET_TYPES,
  normalizeBudgetCategories,
  computeAccountActuals,
  enrichBudgetWithActuals,
  normalizeFiscalYear,
} from './_shared';

export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const type = searchParams.get('type'); // 'actual' | 'mock' | 'available' | 'custom'
    const fiscalYear = searchParams.get('fiscalYear');
    const limit = parseLimit(searchParams.get('limit'), { def: 200, max: 1000 });
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10) || 0);

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    // `deletedAt: { $exists: false }` hides soft-deleted budgets (DELETE is a
    // soft delete so budget history stays recoverable and audited).
    const filter = { accountId, deletedAt: { $exists: false } };
    if (type) filter.type = type;
    if (fiscalYear) filter.fiscalYear = fiscalYear;
    // Structured FY filter: matches the canonical fiscalYearStart field, and
    // falls back to a label-prefix match for legacy docs never saved with it.
    const fyStartRaw = searchParams.get('fiscalYearStart');
    if (fyStartRaw) {
      const fyStart = parseInt(fyStartRaw, 10);
      if (Number.isFinite(fyStart)) {
        filter.$or = [
          { fiscalYearStart: fyStart },
          { fiscalYearStart: { $exists: false }, fiscalYear: { $regex: `^(FY\\s*)?${fyStart}` } },
        ];
      }
    }

    const col = db.collection('budgets');
    const total = await col.countDocuments(filter);
    const rawBudgets = await col
      .find(filter)
      .sort({ fiscalYearStart: -1, fiscalYear: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // One ledger aggregation for the whole (account-scoped) list, then join.
    const actualsMap = await computeAccountActuals(db, accountId);
    const budgets = rawBudgets.map((b) => enrichBudgetWithActuals(b, actualsMap));

    return NextResponse.json({
      budgets,
      pagination: { total, skip, limit, returned: budgets.length },
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/budgets error', e);
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json();
    const {
      accountId,
      name,
      fiscalYear,
      fiscalYearStart,
      type, // scope: 'actual' | 'mock' | 'available' | 'custom'
      budgetType, // 'annual_fiscal' | 'project' | 'monthly' | 'service' | 'custom'
      categories,
      linkedGrants,
      notes,
      baseAmount,
      carryforwardFromBudgetId,
    } = body || {};

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    // Structured FY: accept an int/'2025' (fiscalYearStart) or a label like
    // 'FY2025-26' (fiscalYear); store both, kept in sync.
    const fy = normalizeFiscalYear(
      fiscalYearStart != null && fiscalYearStart !== '' ? fiscalYearStart : fiscalYear
    );
    if (!fy.fiscalYear) {
      return NextResponse.json({ error: 'fiscalYear is required' }, { status: 400 });
    }
    if (!type || !BUDGET_SCOPE_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of ${BUDGET_SCOPE_TYPES.join(', ')}` }, { status: 400 });
    }
    if (!budgetType || !BUDGET_TYPES.includes(budgetType)) {
      return NextResponse.json({ error: `budgetType must be one of ${BUDGET_TYPES.join(', ')}` }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    let normalized;
    let baseAmountMinor;
    let carriedForwardFrom = null;
    try {
      // Carryforward: seed the new budget's allocations from the source
      // budget's per-category remaining (allocated − actual, floored at 0,
      // integer paise). Client-adjusted categories, when supplied, still win
      // (the UI pre-fills them from the same remaining figures).
      let categoriesInput = categories;
      if (carryforwardFromBudgetId != null && carryforwardFromBudgetId !== '') {
        const srcId = String(carryforwardFromBudgetId);
        if (!ObjectId.isValid(srcId)) throw new FinanceError('Invalid carryforwardFromBudgetId', 400);
        const source = await db.collection('budgets').findOne({ _id: new ObjectId(srcId) });
        if (!source || source.deletedAt) throw new FinanceError('Carryforward source budget not found', 400);
        carriedForwardFrom = {
          budgetId: String(source._id),
          fiscalYear: source.fiscalYear || null,
          fiscalYearStart: source.fiscalYearStart != null
            ? Number(source.fiscalYearStart)
            : normalizeFiscalYear(source.fiscalYear).fiscalYearStart,
        };
        if (!Array.isArray(categories) || categories.length === 0) {
          const sourceActuals = await computeAccountActuals(db, source.accountId);
          categoriesInput = (Array.isArray(source.categories) ? source.categories : []).map((c) => {
            const allocatedMinor = readMinor(c, 'allocated');
            const actualMinor = sourceActuals.get(c.category) || 0;
            const remainingMinor = Math.max(0, allocatedMinor - actualMinor);
            return {
              category: c.category,
              categoryLabel: c.categoryLabel,
              allocated: fromMinor(remainingMinor),
              notes: c.notes || '',
            };
          });
        }
      }

      normalized = normalizeBudgetCategories(categoriesInput);
      if (baseAmount != null && baseAmount !== '') {
        baseAmountMinor = toMinor(baseAmount);
        if (baseAmountMinor < 0) throw new FinanceError('baseAmount must be a non-negative number', 400);
        // Scope guard: allocations may not exceed the scope amount when one is set.
        if (normalized.totalMinor > baseAmountMinor) {
          throw new FinanceError('Total allocated exceeds the scope amount (baseAmount)', 400);
        }
      }
    } catch (err) {
      if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
      throw err;
    }

    const doc = {
      accountId,
      name: capString(name, 200),
      fiscalYear: fy.fiscalYear,
      fiscalYearStart: fy.fiscalYearStart,
      type,
      budgetType,
      workflowStatus: 'draft', // lifecycle always starts in draft
      categories: normalized.list,
      linkedGrants: Array.isArray(linkedGrants)
        ? linkedGrants.filter((g) => typeof g === 'string').map((g) => capString(g, 64)).slice(0, 100)
        : [],
      totalAllocated: fromMinor(normalized.totalMinor),
      totalAllocatedMinor: normalized.totalMinor,
      ...(baseAmountMinor != null ? { baseAmount: fromMinor(baseAmountMinor), baseAmountMinor } : {}),
      ...(carriedForwardFrom ? { carriedForwardFrom } : {}),
      notes: capString(notes, 5000),
      createdAt: new Date(),
      createdBy: actorFromUser(user),
    };

    const res = await db.collection('budgets').insertOne(doc);
    await recordFinanceAudit(db, {
      action: 'budget.create', collection: 'budgets', documentId: res.insertedId,
      actor: actorFromUser(user), after: { _id: res.insertedId, ...doc },
      meta: {
        accountId, type, budgetType, totalAllocatedMinor: normalized.totalMinor,
        ...(carriedForwardFrom ? { carryforwardFromBudgetId: carriedForwardFrom.budgetId } : {}),
      },
    });

    return NextResponse.json({ _id: res.insertedId, ...doc }, { status: 201 });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/budgets error', e);
    return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 });
  }
}
