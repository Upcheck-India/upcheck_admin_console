import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';
import { sendPushNotificationToAll } from '../../../../lib/pushNotifications';

// PUT /api/announcements/[id] - Update an announcement
export async function PUT(request, { params }) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = authData;

    // Authorization check
    if (user.role !== 'Admin' && user.role !== 'Console admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid announcement ID' }, { status: 400 });
    }

    const body = await request.json();
    const { 
      title, 
      content, 
      isImportant, 
      teams, 
      buttonText, 
      buttonUrl, 
      buttonColor 
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const announcementId = new ObjectId(id);
    const existing = await db.collection('announcements').findOne({ _id: announcementId });
    if (!existing) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    const updatedFields = {
      title: title.trim(),
      content: content.trim(),
      isImportant: !!isImportant,
      teams: Array.isArray(teams) ? teams : [],
      buttonText: buttonText ? buttonText.trim() : '',
      buttonUrl: buttonUrl ? buttonUrl.trim() : '',
      buttonColor: buttonColor ? buttonColor.trim() : '',
      updatedAt: new Date(),
    };

    await db.collection('announcements').updateOne(
      { _id: announcementId },
      { $set: updatedFields }
    );

    // If marked important and it wasn't important before, or we want to send notification again on edit
    if (isImportant && !existing.isImportant) {
      sendPushNotificationToAll(
        `📢 ${title.trim()}`,
        content.trim().length > 100 ? `${content.trim().substring(0, 100)}...` : content.trim(),
        { type: 'announcement', announcementId: id }
      ).catch(err => console.error('Error broadcasting announcement push notification:', err));
    }

    return NextResponse.json({ success: true, announcement: { ...existing, ...updatedFields } });
  } catch (error) {
    console.error('Error updating announcement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/announcements/[id] - Delete an announcement
export async function DELETE(request, { params }) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = authData;

    // Authorization check
    if (user.role !== 'Admin' && user.role !== 'Console admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid announcement ID' }, { status: 400 });
    }

    const announcementId = new ObjectId(id);
    const result = await db.collection('announcements').deleteOne({ _id: announcementId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
