import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { requireFinanceAdmin } from '../../../../../lib/finance/auth';
import { readMinor, fromMinor } from '../../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';
import { advanceByFrequency, periodKeyFor, addDays } from '../_recur';

// Recurring-bill generator.
//
// This endpoint is IDEMPOTENT per (subscriptionId, periodKey): the unique sparse
// index on vendor_bills means a period that was already generated throws E11000,
// which we catch and treat as "already there". That makes it safe to call
// repeatedly — from a "Generate due bills" button OR a scheduled job/cron. There
// is no built-in scheduler; something external must invoke this on a cadence.
//
// It also CATCHES UP: for a subscription whose nextDueDate is in the past, it
// emits one bill per missed period up to `asOf`, bounded to MAX_PERIODS per
// subscription so a misconfigured/old start date can never spin forever.

const MAX_PERIODS = 60;

function shortId(idStr) {
  return String(idStr || '').slice(-6);
}

export async function POST(request) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const asOf = body?.asOf ? new Date(body.asOf) : new Date();
    if (Number.isNaN(asOf.getTime())) return NextResponse.json({ error: 'Invalid asOf date' }, { status: 400 });

    const onlyId = body?.subscriptionId ? String(body.subscriptionId) : null;
    if (onlyId && !ObjectId.isValid(onlyId)) {
      return NextResponse.json({ error: 'Invalid subscriptionId' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const subs = db.collection('vendor_subscriptions');
    const bills = db.collection('vendor_bills');
    const vendorsCol = db.collection('vendors');
    const actor = actorFromUser(user);

    const match = {
      deletedAt: { $exists: false },
      status: 'active',
      nextDueDate: { $lte: asOf },
    };
    if (onlyId) match._id = new ObjectId(onlyId);

    const candidates = await subs.find(match).toArray();

    const generated = [];
    const skipped = [];
    let subsAffected = 0;

    for (const sub of candidates) {
      // Vendor gate: must exist, not deleted, and not suspended.
      let vendor = null;
      if (sub.vendorId && ObjectId.isValid(sub.vendorId)) {
        vendor = await vendorsCol.findOne(
          { _id: new ObjectId(sub.vendorId) },
          { projection: { name: 1, deletedAt: 1, status: 1 } }
        );
      }
      if (!vendor || vendor.deletedAt) {
        skipped.push({ subscriptionId: String(sub._id), reason: 'vendor-missing' });
        continue;
      }
      if ((vendor.status || 'active') === 'suspended') {
        skipped.push({ subscriptionId: String(sub._id), reason: 'vendor-suspended' });
        continue;
      }

      const amountMinor = readMinor(sub, 'amount');
      if (amountMinor <= 0) {
        skipped.push({ subscriptionId: String(sub._id), reason: 'invalid-amount' });
        continue;
      }
      const amount = fromMinor(amountMinor);
      const endDate = sub.endDate ? new Date(sub.endDate) : null;

      let cursor = new Date(sub.nextDueDate);
      let iterations = 0;
      let genForSub = 0;
      let lastBillId = sub.lastBillId || null;
      let lastPeriodKey = sub.lastPeriodKey || null;
      let truncated = false;

      // Advance through every due period up to min(asOf, endDate).
      while (cursor <= asOf && (!endDate || cursor <= endDate)) {
        if (iterations >= MAX_PERIODS) {
          truncated = true;
          break;
        }
        iterations += 1;

        const periodKey = periodKeyFor(cursor, sub.frequency);
        const billDate = new Date(cursor);
        const dueDate = addDays(billDate, sub.dueInDays || 0);
        const billStatus = sub.autoApprove === true ? 'approved' : 'draft';

        const billDoc = {
          vendorId: sub.vendorId,
          accountId: sub.accountId,
          billNumber: `SUB-${shortId(sub._id)}-${periodKey}`,
          description: sub.description || '',
          amount,
          amountMinor,
          billDate,
          dueDate,
          status: billStatus,
          expenseType: sub.expenseType || null,
          subscriptionId: String(sub._id),
          periodKey,
          createdAt: new Date(),
          createdBy: actor,
        };

        try {
          const ins = await bills.insertOne(billDoc);
          generated.push({ subscriptionId: String(sub._id), billId: String(ins.insertedId), periodKey, status: billStatus });
          genForSub += 1;
          lastBillId = String(ins.insertedId);
          lastPeriodKey = periodKey;
        } catch (err) {
          if (err && err.code === 11000) {
            // Period already generated on a previous run — dedupe and move on.
            skipped.push({ subscriptionId: String(sub._id), periodKey, reason: 'duplicate' });
          } else {
            throw err;
          }
        }

        cursor = advanceByFrequency(cursor, sub.frequency, sub.anchorDay || null);
      }

      // Persist the subscription's advanced cursor once (idempotent: a crash
      // before this leaves nextDueDate unchanged and the next run re-dedupes).
      const set = { nextDueDate: cursor, updatedAt: new Date(), updatedBy: actor };
      if (genForSub > 0) {
        set.lastGeneratedAt = new Date();
        set.lastBillId = lastBillId;
        set.lastPeriodKey = lastPeriodKey;
      }
      const inc = genForSub > 0 ? { generatedCount: genForSub } : null;

      // Auto-complete: once the cursor passes endDate, the subscription is done.
      let completed = false;
      if (endDate && cursor > endDate && !truncated) {
        set.status = 'cancelled';
        completed = true;
      }

      const update = inc ? { $set: set, $inc: inc } : { $set: set };
      await subs.updateOne({ _id: sub._id }, update);
      subsAffected += 1;

      if (truncated) {
        skipped.push({ subscriptionId: String(sub._id), reason: 'max-periods-reached', note: `Stopped after ${MAX_PERIODS} periods; run again to continue.` });
      }
      if (completed) {
        skipped.push({ subscriptionId: String(sub._id), reason: 'completed', note: 'Reached end date; subscription cancelled.' });
      }
    }

    await recordFinanceAudit(db, {
      action: 'subscription.generate', collection: 'vendor_subscriptions',
      documentId: onlyId || null,
      actor,
      meta: {
        asOf: asOf.toISOString(),
        candidates: candidates.length,
        subsAffected,
        generatedCount: generated.length,
        skippedCount: skipped.length,
      },
    });

    return NextResponse.json({ generated, count: generated.length, skipped });
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('POST /api/organization/vendor-subscriptions/generate error', e);
    return NextResponse.json({ error: 'Failed to generate bills' }, { status: 500 });
  }
}
