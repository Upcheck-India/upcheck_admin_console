import { NextResponse } from 'next/server';
import { requireAuth, logActivity } from '../../../../../../lib/serverAuth';
import { notifyClaimRequested } from '../../../../../../lib/scheduleNotifications';
import {
  validateClaim, isAdmitted, isBlockAdmin, dayKeyFor, weekKeyFor, wallToUtc,
} from '../../../../../../lib/scheduleBlocks';
import {
  CLAIMS, loadBlock, withTeams, overlappingClaims, quotaUsage,
  leaveWarningFor, insertConfirmedClaim, displayName,
} from '../../../../../../lib/scheduleClaimStore';

// The grid may send either UTC instants or a block-zone wall-clock range.
// The wall-clock form is what the calendar actually knows, so it is preferred.
function readRange(body, block) {
  if (body.date && body.startTime && body.endTime && !String(body.startTime).includes('T')) {
    return {
      start: wallToUtc(body.date, body.startTime, block.timezone),
      end: wallToUtc(body.date, body.endTime, block.timezone),
    };
  }
  const start = body.startTime ? new Date(body.startTime) : null;
  const end = body.endTime ? new Date(body.endTime) : null;
  return { start, end };
}

// GET /api/scheduling/blocks/[id]/claims?from=&to= — the grid feed.
export async function GET(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  try {
    const { id } = await params;
    const block = await loadBlock(db, id);
    if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const me = await withTeams(db, user);
    if (!isAdmitted(block, me)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const from = new Date(searchParams.get('from') || Date.now() - 7 * 86400000);
    const to = new Date(searchParams.get('to') || Date.now() + 31 * 86400000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: 'Invalid from/to' }, { status: 400 });
    }

    const claims = await db.collection(CLAIMS).find({
      blockId: String(block._id),
      status: { $in: ['confirmed', 'pending'] },
      startTime: { $lt: to },
      endTime: { $gt: from },
    }).sort({ startTime: 1 }).limit(2000).toArray();

    return NextResponse.json({ claims, block, canManage: isBlockAdmin(block, me), userId: String(user._id) });
  } catch (e) {
    console.error('claims GET', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/scheduling/blocks/[id]/claims — claim a slot.
export async function POST(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  try {
    const { id } = await params;
    const block = await loadBlock(db, id);
    if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const me = await withTeams(db, user);
    const body = await req.json().catch(() => ({}));
    const { start, end } = readRange(body, block);
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: 'A valid start and end are required' }, { status: 400 });
    }

    // Cheap, DB-free checks first, so an illegal request never hits Mongo.
    const dry = validateClaim({ block, user: me, start, end });
    if (!dry.ok && !['taken', 'over_day_quota', 'over_week_quota', 'over_claim_count'].includes(dry.code)) {
      return NextResponse.json({ error: dry.message, code: dry.code }, { status: dry.code === 'not_admitted' ? 403 : 400 });
    }

    const dayKey = dayKeyFor(start, block.timezone);
    const weekKey = weekKeyFor(start, block.timezone);
    const [overlapping, usage] = await Promise.all([
      overlappingClaims(db, block._id, start, end),
      quotaUsage(db, block._id, user._id, dayKey, weekKey),
    ]);

    const verdict = validateClaim({ block, user: me, start, end, overlapping, usage });
    if (!verdict.ok) {
      return NextResponse.json(
        { error: verdict.message, code: verdict.code },
        { status: verdict.code === 'taken' ? 409 : 400 },
      );
    }

    const now = new Date();
    const doc = {
      blockId: String(block._id),
      userId: String(user._id),
      userEmail: user.email || '',
      userName: displayName(user),
      startTime: start,
      endTime: end,
      minutes: verdict.minutes,
      dayKey: verdict.dayKey,
      weekKey: verdict.weekKey,
      note: String(body.note || '').trim().slice(0, 500),
      createdAt: now,
      decidedAt: null,
      decidedBy: null,
      cancelReason: null,
      leaveWarning: await leaveWarningFor(db, user._id, verdict.dayKey),
    };

    // Approval mode reserves nothing: two people may hold pending claims on the
    // same slot, and whichever the owner approves first takes it.
    if (block.claimMode === 'approval') {
      const claim = { ...doc, status: 'pending' };
      const res = await db.collection(CLAIMS).insertOne(claim);
      await logActivity(db, {
        action: 'schedule_claim_requested', actor: user, targetType: 'schedule_claim',
        targetId: res.insertedId, targetName: block.title, metadata: { dayKey, minutes: doc.minutes },
      });
      // A pending claim that notifies nobody just sits there: the owner has no
      // idea it exists and the claimant is told "awaiting approval" by someone
      // who was never asked. Fire-and-forget — a claim must not fail because a
      // notification could not be sent.
      notifyClaimRequested(block, { ...claim, _id: res.insertedId }).catch((e) =>
        console.error('[schedule] claim-request push failed', e),
      );
      return NextResponse.json({ claim: { ...claim, _id: res.insertedId } }, { status: 201 });
    }

    const result = await insertConfirmedClaim(db, block, doc);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'Someone just took part of that range. The grid has been refreshed.', code: 'taken' },
        { status: 409 },
      );
    }
    await logActivity(db, {
      action: 'schedule_claim_created', actor: user, targetType: 'schedule_claim',
      targetId: result.claim._id, targetName: block.title, metadata: { dayKey, minutes: doc.minutes },
    });
    return NextResponse.json({ claim: result.claim }, { status: 201 });
  } catch (e) {
    console.error('claims POST', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
