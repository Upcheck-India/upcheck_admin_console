import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { FinanceError } from '../../../../lib/finance/tx';
import { requireFinanceAdmin, capString, parseLimit } from '../../../../lib/finance/auth';
import { moneyFields, minorExpr, fromMinor } from '../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../lib/finance/audit';
import {
  ALLOWED_STATUSES,
  EMAIL_RE,
  deriveFundingStage,
  normalizeApplication,
  sanitizeAttachments,
  sanitizeMilestones,
  buildReminders,
} from './lifecycle';

// Status whitelist, transition rules and the unified received-to-org
// bookkeeping (single source of truth: untransferredId → receivedToOrg; legacy
// `transferred` only mirror-written) live in ./lifecycle.js — shared with the
// [id] route.

export async function GET(request) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const status = searchParams.get('status');
    const limit = parseLimit(searchParams.get('limit'), { def: 200, max: 1000 });
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10) || 0);

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }
    if (status && !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('grant_applications');

    // The status facet only narrows the LIST; the summary is always computed
    // account-wide so the header cards stay stable while filtering.
    const listFilter = { accountId };
    if (status) listFilter.status = status;

    const totalCount = await col.countDocuments(listFilter);
    const rawApplications = await col
      .find(listFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Normalize every returned document to the unified model so the UI badges
    // and the "mark received" gating are consistent regardless of legacy flags.
    const applications = rawApplications.map(normalizeApplication);

    // ---- Summary: counts + money, computed in integer paise via minorExpr ----
    // Consistency rule (X.3): each count and its money total cover EXACTLY the
    // same set of documents. `granted`/`totalGranted` cover status === 'granted';
    // `pendingTransfer`/`totalPendingTransfer` cover status === 'pending_transfer'.
    // The two buckets are reported separately (never mixed), so count and money
    // can never disagree.
    const receivedCond = {
      $or: [
        { $ne: [{ $ifNull: ['$untransferredId', null] }, null] },
        { $eq: ['$receivedToOrg', true] },
        { $eq: ['$transferred', true] },
      ],
    };
    const grantedNotReceived = {
      $and: [{ $eq: ['$status', 'granted'] }, { $not: [receivedCond] }],
    };

    const summaryAgg = await col
      .aggregate([
        { $match: { accountId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            needToApply: { $sum: { $cond: [{ $eq: ['$status', 'need_to_apply'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            waiting: { $sum: { $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0] } },
            granted: { $sum: { $cond: [{ $eq: ['$status', 'granted'] }, 1, 0] } },
            pendingTransfer: { $sum: { $cond: [{ $eq: ['$status', 'pending_transfer'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
            totalGrantedMinor: { $sum: { $cond: [{ $eq: ['$status', 'granted'] }, minorExpr('amount'), 0] } },
            totalPendingTransferMinor: { $sum: { $cond: [{ $eq: ['$status', 'pending_transfer'] }, minorExpr('amount'), 0] } },
            // Granted money still sitting with the application (not yet pushed to
            // the untransferred pool). Once received, it is tracked by the
            // Untransferred module and no longer counted here.
            untransferredMinor: { $sum: { $cond: [grantedNotReceived, minorExpr('amount'), 0] } },
          },
        },
      ])
      .toArray();

    const s = summaryAgg[0] || {};
    const summary = {
      total: s.total || 0,
      needToApply: s.needToApply || 0,
      pending: s.pending || 0,
      waiting: s.waiting || 0,
      granted: s.granted || 0,
      pendingTransfer: s.pendingTransfer || 0,
      rejected: s.rejected || 0,
      totalGranted: fromMinor(s.totalGrantedMinor || 0),
      totalPendingTransfer: fromMinor(s.totalPendingTransferMinor || 0),
      untransferred: fromMinor(s.untransferredMinor || 0),
    };

    // ---- Deadline reminders (task 2.9) — derived at read time, no cron ----
    // Computed account-wide (lean projection), not just from the current page,
    // so the banner never hides an overdue item behind pagination/filters.
    const reminderSource = await col
      .find(
        { accountId, status: { $ne: 'rejected' } },
        { projection: { programName: 1, status: 1, deadline: 1, milestones: 1 } }
      )
      .limit(1000)
      .toArray();
    const reminders = buildReminders(reminderSource);

    return NextResponse.json({
      applications,
      summary,
      reminders,
      pagination: { total: totalCount, skip, limit, returned: applications.length },
    });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('GET /api/organization/grant-applications error', e);
    return NextResponse.json({ error: 'Failed to fetch grant applications' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json();
    const {
      accountId,
      programName,
      organizationName,
      amount,
      applicationDate,
      deadline,
      status,
      notes,
      category,
      fundingPeriod,
      contactPerson,
      contactEmail,
      attachments,
      milestones,
    } = body || {};

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }
    const cleanProgram = capString(programName, 200);
    if (!cleanProgram) {
      return NextResponse.json({ error: 'programName is required' }, { status: 400 });
    }
    const cleanOrg = capString(organizationName, 200);
    if (!cleanOrg) {
      return NextResponse.json({ error: 'organizationName is required' }, { status: 400 });
    }

    const initialStatus = status || 'need_to_apply';
    if (!ALLOWED_STATUSES.includes(initialStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const cleanEmail = capString(contactEmail, 200);
    if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
      return NextResponse.json({ error: 'Invalid contact email' }, { status: 400 });
    }

    let money;
    try {
      money = moneyFields('amount', amount); // validates & rounds to paise
      if (money.amountMinor <= 0) throw new FinanceError('Valid amount is required', 400);
    } catch (err) {
      if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
      throw err;
    }

    const fundingStage = deriveFundingStage(initialStatus, false);
    const doc = {
      accountId,
      programName: cleanProgram,
      organizationName: cleanOrg,
      ...money,
      applicationDate: capString(applicationDate, 40) || null,
      deadline: capString(deadline, 40) || null,
      status: initialStatus,
      notes: capString(notes, 2000),
      category: capString(category, 100),
      fundingPeriod: capString(fundingPeriod, 100),
      contactPerson: capString(contactPerson, 200),
      contactEmail: cleanEmail,
      attachments: sanitizeAttachments(attachments),
      milestones: sanitizeMilestones(milestones, []),
      // Unified bookkeeping — single source of truth (see ./lifecycle.js).
      fundingStage,
      receivedToOrg: false,
      untransferredId: null,
      createdAt: new Date(),
      createdBy: actorFromUser(user),
    };

    const client = await clientPromise;
    const db = client.db('resources');
    const res = await db.collection('grant_applications').insertOne(doc);
    await recordFinanceAudit(db, {
      action: 'grant.create',
      collection: 'grant_applications',
      documentId: res.insertedId,
      actor: actorFromUser(user),
      after: doc,
      meta: { accountId, status: initialStatus, amountMinor: money.amountMinor },
    });

    return NextResponse.json({ _id: res.insertedId, ...doc }, { status: 201 });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/grant-applications error', e);
    return NextResponse.json({ error: 'Failed to create grant application' }, { status: 500 });
  }
}
