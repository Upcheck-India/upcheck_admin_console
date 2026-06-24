import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../lib/auth';
import { ObjectId } from 'mongodb';

// POST /api/announcements/[id]/react - Toggle reaction
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

    const { emoji } = await request.json();
    if (!emoji || !emoji.trim()) {
      return NextResponse.json({ error: 'Emoji is required' }, { status: 400 });
    }

    const announcementId = new ObjectId(id);
    const announcement = await db.collection('announcements').findOne({ _id: announcementId });

    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    // Check if this reaction already exists for this user
    const existingReactionIndex = (announcement.reactions || []).findIndex(
      r => r.emoji === emoji && r.userId === user._id.toString()
    );

    if (existingReactionIndex !== -1) {
      // Toggle off - Remove the reaction
      await db.collection('announcements').updateOne(
        { _id: announcementId },
        { $pull: { reactions: { emoji, userId: user._id.toString() } } }
      );
      return NextResponse.json({ success: true, action: 'removed' });
    } else {
      // Toggle on - Add the reaction
      const newReaction = {
        emoji: emoji.trim(),
        userId: user._id.toString(),
        username: user.username,
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.username,
      };

      await db.collection('announcements').updateOne(
        { _id: announcementId },
        { $push: { reactions: newReaction } }
      );
      return NextResponse.json({ success: true, action: 'added', reaction: newReaction });
    }
  } catch (error) {
    console.error('Error toggling reaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
