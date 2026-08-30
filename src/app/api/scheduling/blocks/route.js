import { NextResponse } from 'next/server';
import { requireAuth, isAdminRole, logActivity } from '../../../../lib/serverAuth';
import { normalizeBlock } from '../../../../lib/scheduleBlocks';
import { BLOCKS, CLAIMS, userTeamIds, displayName } from '../../../../lib/scheduleClaimStore';

// The Mongo filter for "blocks this user is allowed to see".
function visibilityFilter(user, teamIds) {
  const uid = String(user._id);
  if (isAdminRole(user.role)) return {};
  return {
    'access.denyUserIds': { $ne: uid },      // deny always wins
    $or: [
      { ownerId: uid },
      { 'access.visibility': { $ne: 'restricted' } },
      { 'access.allowUserIds': uid },
      { 'access.allowRoles': user.role },
      { 'access.allowTeams': { $in: teamIds } },
    ],
  };
}

// GET /api/scheduling/blocks — blocks this user may see, with claim counts.
export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  try {
    const { searchParams } = new URL(req.url);
    const teamIds = await userTeamIds(db, user);
    const filter = visibilityFilter(user, teamIds);
    if (searchParams.get('status')) filter.status = searchParams.get('status');
    else filter.status = { $ne: 'closed' };

    const blocks = await db.collection(BLOCKS).find(filter).sort({ createdAt: -1 }).limit(200).toArray();

    // One grouped count instead of a query per block.
    const ids = blocks.map((b) => String(b._id));
    const counts = ids.length
      ? await db.collection(CLAIMS).aggregate([
        { $match: { blockId: { $in: ids }, status: { $in: ['confirmed', 'pending'] } } },
        { $group: { _id: { blockId: '$blockId', status: '$status' }, n: { $sum: 1 } } },
      ]).toArray()
      : [];
    const byBlock = {};
    for (const c of counts) {
      const b = (byBlock[c._id.blockId] ||= { confirmed: 0, pending: 0 });
      b[c._id.status] = c.n;
    }

    return NextResponse.json({
      blocks: blocks.map((b) => ({ ...b, counts: byBlock[String(b._id)] || { confirmed: 0, pending: 0 } })),
      isAdmin: isAdminRole(user.role),
      userId: String(user._id),
    });
  } catch (e) {
    console.error('blocks GET', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/scheduling/blocks — create a block. Any signed-in user may own one.
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const { block, error } = normalizeBlock(body);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const now = new Date();
    const doc = {
      ...block,
      ownerId: String(user._id),
      ownerEmail: user.email || '',
      ownerName: displayName(user),
      createdAt: now,
      updatedAt: now,
      createdBy: String(user._id),
    };
    const result = await db.collection(BLOCKS).insertOne(doc);
    await logActivity(db, {
      action: 'schedule_block_created', actor: user, targetType: 'schedule_block',
      targetId: result.insertedId, targetName: doc.title,
    });
    return NextResponse.json({ block: { ...doc, _id: result.insertedId } }, { status: 201 });
  } catch (e) {
    console.error('blocks POST', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
