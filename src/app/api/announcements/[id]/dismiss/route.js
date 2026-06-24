import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../lib/auth';
import { ObjectId } from 'mongodb';

// POST /api/announcements/[id]/dismiss - Dismiss an announcement for current user
export async function POST(request, { params }) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = authData;

    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid announcement ID' }, { status: 400 });
    }

    const announcementId = new ObjectId(id);
    
    // Add current user's ID to the dismissedBy list (using $addToSet to avoid duplicates)
    const result = await db.collection('announcements').updateOne(
      { _id: announcementId },
      { $addToSet: { dismissedBy: user._id.toString() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error dismissing announcement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
