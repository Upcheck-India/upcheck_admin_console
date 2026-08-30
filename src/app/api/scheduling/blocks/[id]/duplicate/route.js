import { NextResponse } from 'next/server';
import { requireAuth, logActivity } from '../../../../../../lib/serverAuth';
import { normalizeBlock, isBlockAdmin } from '../../../../../../lib/scheduleBlocks';
import { BLOCKS, loadBlock, displayName } from '../../../../../../lib/scheduleClaimStore';

// 'YYYY-MM-DD' + n days, in plain calendar terms (no zone involved).
function shiftDate(dateStr, days) {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d + days));
  return t.toISOString().slice(0, 10);
}

// POST /api/scheduling/blocks/[id]/duplicate — "next week's round".
// Body: { shiftDays?: 7, title?, startDate?, endDate? }
export async function POST(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  try {
    const { id } = await params;
    const block = await loadBlock(db, id);
    if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!isBlockAdmin(block, user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const shift = Number.isFinite(Number(body.shiftDays)) ? Number(body.shiftDays) : 7;

    const { _id, createdAt, updatedAt, ownerId, ownerEmail, ownerName, createdBy, closedBy, closedByName, ...rest } = block;
    const { block: next, error } = normalizeBlock({
      ...rest,
      title: body.title || `${block.title} (copy)`,
      startDate: body.startDate || shiftDate(block.startDate, shift),
      endDate: body.endDate !== undefined ? body.endDate : shiftDate(block.endDate, shift),
      status: 'open',
    });
    if (error) return NextResponse.json({ error }, { status: 400 });

    const now = new Date();
    const doc = {
      ...next,
      ownerId: String(user._id),
      ownerEmail: user.email || '',
      ownerName: displayName(user),
      duplicatedFrom: String(block._id),
      createdAt: now,
      updatedAt: now,
      createdBy: String(user._id),
    };
    const result = await db.collection(BLOCKS).insertOne(doc);
    await logActivity(db, {
      action: 'schedule_block_duplicated', actor: user, targetType: 'schedule_block',
      targetId: result.insertedId, targetName: doc.title, metadata: { from: String(block._id), shiftDays: shift },
    });
    return NextResponse.json({ block: { ...doc, _id: result.insertedId } }, { status: 201 });
  } catch (e) {
    console.error('block duplicate POST', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
