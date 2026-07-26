import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../../../lib/mongodb';
import { FinanceError } from '../../../../../lib/finance/tx';
import { requireFinanceAdmin, capString } from '../../../../../lib/finance/auth';
import { moneyFields } from '../../../../../lib/finance/money';
import { recordFinanceAudit, actorFromUser } from '../../../../../lib/finance/audit';
import {
  ALLOWED_STATUSES,
  STATUS_TRANSITIONS,
  canTransition,
  EMAIL_RE,
  deriveFundingStage,
  isReceivedToOrg,
  normalizeApplication,
  sanitizeAttachments,
  sanitizeMilestones,
} from '../lifecycle';

export async function GET(request, { params }) {
  try {
    const { response } = await requireFinanceAdmin(request);
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const item = await db.collection('grant_applications').findOne({ _id: new ObjectId(id) });
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(normalizeApplication(item));
  } catch (e) {
    console.error('GET /api/organization/grant-applications/[id] error', e);
    return NextResponse.json({ error: 'Failed to fetch grant application' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('grant_applications');

    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const {
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
      untransferredId,
      // NOTE: transferred / transferredToFundId / transferredAt / receivedToOrg /
      // createdBy / updatedBy are deliberately NOT read from the client. The
      // received-to-org state is derived from the untransferredId link (single
      // source of truth — see ../lifecycle.js) and actors are set server-side.
    } = body || {};

    const update = { updatedAt: new Date(), updatedBy: actorFromUser(user) };

    if (programName !== undefined) {
      const clean = capString(programName, 200);
      if (!clean) return NextResponse.json({ error: 'programName cannot be empty' }, { status: 400 });
      update.programName = clean;
    }
    if (organizationName !== undefined) {
      const clean = capString(organizationName, 200);
      if (!clean) return NextResponse.json({ error: 'organizationName cannot be empty' }, { status: 400 });
      update.organizationName = clean;
    }
    if (amount !== undefined) {
      try {
        const money = moneyFields('amount', amount); // validates & rounds to paise
        if (money.amountMinor <= 0) throw new FinanceError('Invalid amount', 400);
        Object.assign(update, money);
      } catch (err) {
        if (err && err.isFinanceError) return NextResponse.json({ error: err.message }, { status: err.status || 400 });
        throw err;
      }
    }
    if (applicationDate !== undefined) update.applicationDate = capString(applicationDate, 40) || null;
    if (deadline !== undefined) update.deadline = capString(deadline, 40) || null;
    if (notes !== undefined) update.notes = capString(notes, 2000);
    if (category !== undefined) update.category = capString(category, 100);
    if (fundingPeriod !== undefined) update.fundingPeriod = capString(fundingPeriod, 100);
    if (contactPerson !== undefined) update.contactPerson = capString(contactPerson, 200);
    if (contactEmail !== undefined) {
      const cleanEmail = capString(contactEmail, 200);
      if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
        return NextResponse.json({ error: 'Invalid contact email' }, { status: 400 });
      }
      update.contactEmail = cleanEmail;
    }
    // Attachments / milestones (task 2.9): full-replace when the key is
    // present. Milestone doneAt is stamped server-side against the before-image.
    if (attachments !== undefined) {
      update.attachments = sanitizeAttachments(attachments);
    }
    if (milestones !== undefined) {
      update.milestones = sanitizeMilestones(milestones, existing.milestones || []);
    }

    // ---- Status state machine (task 1.7) ----
    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      if (!canTransition(existing.status, status)) {
        const allowed = STATUS_TRANSITIONS[existing.status] || [];
        return NextResponse.json(
          { error: `Cannot change status from '${existing.status}' to '${status}'. Allowed: ${allowed.join(', ') || 'none'}.` },
          { status: 409 }
        );
      }
      // Money already received into the org pool → the application is settled;
      // it must stay 'granted'. Manage the money in Untransferred instead.
      if (existing.untransferredId != null && status !== 'granted') {
        return NextResponse.json(
          { error: 'Funds were already received into the organization. Status is locked to granted; manage the money under Untransferred funds.' },
          { status: 409 }
        );
      }
      update.status = status;
    }

    // ---- Received-to-org link (task X.2: single source of truth) ----
    // `untransferredId` is the canonical marker that money arrived; the
    // `receivedToOrg` boolean and the legacy `transferred` flag are written in
    // sync with it, never accepted independently.
    if (untransferredId !== undefined) {
      if (untransferredId === null || untransferredId === '') {
        update.untransferredId = null;
        update.receivedToOrg = false;
        update.transferred = false;
      } else {
        const linkId = String(untransferredId);
        if (!ObjectId.isValid(linkId)) {
          return NextResponse.json({ error: 'Invalid untransferredId' }, { status: 400 });
        }
        const poolRec = await db.collection('org_untransferred').findOne(
          { _id: new ObjectId(linkId), deletedAt: { $exists: false } },
          { projection: { _id: 1 } }
        );
        if (!poolRec) {
          return NextResponse.json({ error: 'Untransferred record not found' }, { status: 400 });
        }
        update.untransferredId = linkId;
        update.receivedToOrg = true;
        update.transferred = true; // legacy mirror, kept for old readers
        if (!existing.receivedAt) update.receivedAt = new Date();
      }
    }

    // Recompute the derived stage from the FINAL state of the document.
    const merged = { ...existing, ...update };
    update.fundingStage = deriveFundingStage(merged.status, isReceivedToOrg(merged));

    await col.updateOne({ _id: new ObjectId(id) }, { $set: update });
    await recordFinanceAudit(db, {
      action: 'grant.update',
      collection: 'grant_applications',
      documentId: id,
      actor: actorFromUser(user),
      before: existing,
      after: { _id: existing._id, ...existing, ...update },
      meta: {
        accountId: existing.accountId,
        statusFrom: existing.status,
        statusTo: merged.status,
        ...(update.attachments
          ? { attachmentsBefore: (existing.attachments || []).length, attachmentsAfter: update.attachments.length }
          : {}),
        ...(update.milestones
          ? { milestonesBefore: (existing.milestones || []).length, milestonesAfter: update.milestones.length }
          : {}),
      },
    });

    return NextResponse.json(normalizeApplication({ ...existing, ...update }));
  } catch (e) {
    if (e && e.isFinanceError) return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    console.error('PUT /api/organization/grant-applications/[id] error', e);
    return NextResponse.json({ error: 'Failed to update grant application' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { user, response } = await requireFinanceAdmin(request, { mutation: true });
    if (response) return response;

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');
    const col = db.collection('grant_applications');

    // Hard delete (matches historical behavior for this collection — grant
    // applications are planning records, not ledger rows), but the full
    // before-image is preserved in the audit log so nothing is lost silently.
    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await col.deleteOne({ _id: new ObjectId(id) });
    await recordFinanceAudit(db, {
      action: 'grant.delete',
      collection: 'grant_applications',
      documentId: id,
      actor: actorFromUser(user),
      before: existing,
      meta: { accountId: existing.accountId, status: existing.status },
    });

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error('DELETE /api/organization/grant-applications/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete grant application' }, { status: 500 });
  }
}
