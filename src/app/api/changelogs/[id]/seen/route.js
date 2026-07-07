import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../lib/auth';
import { ObjectId } from 'mongodb';

// POST /api/changelogs/[id]/seen — mark a changelog acknowledged for the
// current user (upsert, idempotent). Called when a banner is dismissed, a
// popup/forced popup is acknowledged, or the full-page view is opened.
export async function POST(request, { params }) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = authData;

    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid changelog ID' }, { status: 400 });
    }

    const userId = user._id.toString();
    await db.collection('changelog_seen').updateOne(
      { userId, changelogId: id },
      { $set: { userId, changelogId: id, seenAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking changelog seen:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
