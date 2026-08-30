import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireAuth } from '../../../../../lib/serverAuth';
import { CLAIMS, BLOCKS } from '../../../../../lib/scheduleClaimStore';

// GET /api/scheduling/claims/mine?upcoming=1 — everything this person holds.
export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  try {
    const { searchParams } = new URL(req.url);
    const q = { userId: String(user._id), status: { $in: ['confirmed', 'pending'] } };
    if (searchParams.get('upcoming') === '1') q.endTime = { $gte: new Date() };

    const claims = await db.collection(CLAIMS).find(q).sort({ startTime: 1 }).limit(500).toArray();
    const blockIds = [...new Set(claims.map((c) => c.blockId))].filter(ObjectId.isValid);
    const blocks = blockIds.length
      ? await db.collection(BLOCKS).find(
        { _id: { $in: blockIds.map((i) => new ObjectId(i)) } },
        { projection: { title: 1, icon: 1, color: 1, timezone: 1, claimMode: 1, cancellableUntilMinutesBefore: 1 } },
      ).toArray()
      : [];
    const byId = Object.fromEntries(blocks.map((b) => [String(b._id), b]));

    return NextResponse.json({ claims: claims.map((c) => ({ ...c, block: byId[c.blockId] || null })) });
  } catch (e) {
    console.error('claims/mine GET', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
