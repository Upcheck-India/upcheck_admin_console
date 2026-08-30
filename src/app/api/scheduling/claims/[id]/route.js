import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireAuth, logActivity } from '../../../../../lib/serverAuth';
import { validateClaim, isBlockAdmin } from '../../../../../lib/scheduleBlocks';
import {
  CLAIMS, BLOCKS, withTeams, overlappingClaims, quotaUsage,
  reserveSlots, releaseSlots, displayName,
} from '../../../../../lib/scheduleClaimStore';
import { sendEmail } from '../../../../../lib/emailService';

const fmt = (d, tz) => new Date(d).toLocaleString('en-GB', {
  timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

// Best-effort: a claim decision must not fail because SMTP is down.
async function notify(claim, block, verb, by) {
  if (!claim.userEmail) return;
  try {
    await sendEmail({
      to: claim.userEmail,
      subject: `Your claim on "${block.title}" was ${verb}`,
      html: `<p>Hi ${claim.userName || 'there'},</p>
<p>Your claim on <strong>${block.title}</strong> for
<strong>${fmt(claim.startTime, block.timezone)} – ${fmt(claim.endTime, block.timezone)}</strong>
(${block.timezone}) was <strong>${verb}</strong> by ${by}.</p>`,
    });
  } catch (e) {
    console.error('claim decision email failed', e);
  }
}

// PATCH /api/scheduling/claims/[id] — { action: 'approve' | 'reject' | 'cancel' }
export async function PATCH(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const claim = await db.collection(CLAIMS).findOne({ _id: new ObjectId(id) });
    if (!claim) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const block = await db.collection(BLOCKS).findOne({ _id: new ObjectId(claim.blockId) });
    if (!block) return NextResponse.json({ error: 'Block not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const canManage = isBlockAdmin(block, user);
    const isHolder = String(claim.userId) === String(user._id);
    const now = new Date();

    if (action === 'cancel') {
      if (!isHolder && !canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (!['confirmed', 'pending'].includes(claim.status)) {
        return NextResponse.json({ error: `This claim is already ${claim.status}` }, { status: 400 });
      }
      const cutoff = block.cancellableUntilMinutesBefore;
      if (isHolder && !canManage && cutoff != null
        && new Date(claim.startTime).getTime() - now.getTime() < cutoff * 60000) {
        return NextResponse.json({ error: `Claims can only be cancelled ${cutoff} minutes ahead` }, { status: 400 });
      }
      await releaseSlots(db, claim._id);
      await db.collection(CLAIMS).updateOne({ _id: claim._id }, {
        $set: {
          status: 'cancelled',
          decidedAt: now,
          decidedBy: String(user._id),
          cancelReason: String(body.reason || '').trim().slice(0, 300) || null,
        },
      });
      await logActivity(db, {
        action: 'schedule_claim_cancelled', actor: user, targetType: 'schedule_claim',
        targetId: claim._id, targetName: block.title,
      });
      if (!isHolder) await notify(claim, block, 'cancelled', displayName(user));
      return NextResponse.json({ ok: true, status: 'cancelled' });
    }

    if (action === 'reject') {
      if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (claim.status !== 'pending') return NextResponse.json({ error: `This claim is ${claim.status}` }, { status: 400 });
      await db.collection(CLAIMS).updateOne({ _id: claim._id }, {
        $set: {
          status: 'rejected', decidedAt: now, decidedBy: String(user._id),
          cancelReason: String(body.reason || '').trim().slice(0, 300) || null,
        },
      });
      await logActivity(db, {
        action: 'schedule_claim_rejected', actor: user, targetType: 'schedule_claim',
        targetId: claim._id, targetName: block.title,
      });
      await notify(claim, block, 'rejected', displayName(user));
      return NextResponse.json({ ok: true, status: 'rejected' });
    }

    if (action === 'approve') {
      if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (claim.status !== 'pending') return NextResponse.json({ error: `This claim is ${claim.status}` }, { status: 400 });

      // A pending claim reserved nothing, so capacity and quota are re-checked
      // here — the slot may well have gone since the request was made.
      const holder = await db.collection('admin_users').findOne(
        { _id: new ObjectId(String(claim.userId)) }, { projection: { password: 0 } },
      );
      if (!holder) return NextResponse.json({ error: 'The claimant no longer exists' }, { status: 400 });
      const holderCtx = await withTeams(db, holder);

      const start = new Date(claim.startTime);
      const end = new Date(claim.endTime);
      const [overlapping, usage] = await Promise.all([
        overlappingClaims(db, block._id, start, end, claim._id),
        quotaUsage(db, block._id, claim.userId, claim.dayKey, claim.weekKey, claim._id),
      ]);
      // The window/notice checks are skipped on approval: the owner is
      // deliberately deciding late, and refusing their own queue on notice
      // would make pending claims un-approvable once they aged.
      const verdict = validateClaim({
        block, user: holderCtx, start, end, overlapping, usage,
        now: new Date(start.getTime() - 1),
      });
      if (!verdict.ok) {
        return NextResponse.json(
          { error: verdict.message, code: verdict.code },
          { status: verdict.code === 'taken' ? 409 : 400 },
        );
      }

      const res = await reserveSlots(db, {
        blockId: block._id,
        claimId: claim._id,
        userId: claim.userId,
        start,
        end,
        granularityMinutes: block.window.granularityMinutes,
        capacity: block.rules.capacity,
      });
      if (!res.ok) {
        return NextResponse.json({ error: 'Someone else already holds part of that range', code: 'taken' }, { status: 409 });
      }

      const updated = await db.collection(CLAIMS).findOneAndUpdate(
        { _id: claim._id, status: 'pending' },
        { $set: { status: 'confirmed', seat: res.seat, decidedAt: now, decidedBy: String(user._id) } },
        { returnDocument: 'after' },
      );
      if (!updated) {                       // decided by someone else in between
        await releaseSlots(db, claim._id);
        return NextResponse.json({ error: 'This claim was already decided' }, { status: 409 });
      }
      await logActivity(db, {
        action: 'schedule_claim_approved', actor: user, targetType: 'schedule_claim',
        targetId: claim._id, targetName: block.title,
      });
      await notify(claim, block, 'approved', displayName(user));
      return NextResponse.json({ ok: true, status: 'confirmed' });
    }

    return NextResponse.json({ error: 'action must be approve, reject or cancel' }, { status: 400 });
  } catch (e) {
    console.error('claim PATCH', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
