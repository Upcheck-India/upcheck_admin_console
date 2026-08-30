import { NextResponse } from 'next/server';
import { requireAuth, logActivity } from '../../../../../lib/serverAuth';
import { normalizeBlock, isAdmitted, isBlockAdmin, dayKeyFor, weekKeyFor } from '../../../../../lib/scheduleBlocks';
import { BLOCKS, loadBlock, withTeams, quotaUsage, displayName } from '../../../../../lib/scheduleClaimStore';

// GET /api/scheduling/blocks/[id] — the block plus this caller's remaining quota.
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

    // Quota left "today", read in the block's own timezone.
    const now = new Date();
    const dayKey = dayKeyFor(now, block.timezone);
    const weekKey = weekKeyFor(now, block.timezone);
    const used = await quotaUsage(db, block._id, user._id, dayKey, weekKey);

    return NextResponse.json({
      block,
      canManage: isBlockAdmin(block, me),
      quota: {
        dayKey,
        weekKey,
        ...used,
        dayRemaining: block.rules.maxMinutesPerDay == null ? null : Math.max(0, block.rules.maxMinutesPerDay - used.dayMinutes),
        weekRemaining: block.rules.maxMinutesPerWeek == null ? null : Math.max(0, block.rules.maxMinutesPerWeek - used.weekMinutes),
      },
    });
  } catch (e) {
    console.error('block GET', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/scheduling/blocks/[id] — edit rules, access, status. Owner or admin.
export async function PUT(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  try {
    const { id } = await params;
    const block = await loadBlock(db, id);
    if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!isBlockAdmin(block, user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    // Merge onto the stored block so a partial edit cannot drop rules.
    const { block: next, error } = normalizeBlock(body, block);
    if (error) return NextResponse.json({ error }, { status: 400 });

    await db.collection(BLOCKS).updateOne({ _id: block._id }, { $set: { ...next, updatedAt: new Date() } });
    await logActivity(db, {
      action: 'schedule_block_updated', actor: user, targetType: 'schedule_block',
      targetId: block._id, targetName: next.title,
    });
    return NextResponse.json({ block: { ...block, ...next } });
  } catch (e) {
    console.error('block PUT', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/scheduling/blocks/[id] — soft close. Existing claims are kept.
export async function DELETE(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  try {
    const { id } = await params;
    const block = await loadBlock(db, id);
    if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!isBlockAdmin(block, user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await db.collection(BLOCKS).updateOne(
      { _id: block._id },
      { $set: { status: 'closed', updatedAt: new Date(), closedBy: String(user._id), closedByName: displayName(user) } },
    );
    await logActivity(db, {
      action: 'schedule_block_closed', actor: user, targetType: 'schedule_block',
      targetId: block._id, targetName: block.title,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('block DELETE', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
