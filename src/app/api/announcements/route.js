import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../lib/auth';
import { sendPushNotificationToAll } from '../../../lib/pushNotifications';

// GET /api/announcements - Fetch announcements
export async function GET(request) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = authData;

    const { searchParams } = new URL(request.url);
    const getAll = searchParams.get('all') === 'true';

    let query = {};
    if (!getAll) {
      // Filter out announcements dismissed by the current user
      query = { dismissedBy: { $ne: user._id.toString() } };
    }

    const announcements = await db.collection('announcements')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ announcements });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/announcements - Create new announcement
export async function POST(request) {
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

    const body = await request.json();
    const { title, content, isImportant } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const announcement = {
      title: title.trim(),
      content: content.trim(),
      isImportant: !!isImportant,
      createdBy: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.username,
      },
      createdAt: new Date(),
      reactions: [],
      dismissedBy: [],
    };

    const result = await db.collection('announcements').insertOne(announcement);
    
    // Add the inserted ID to the returned object
    const createdAnnouncement = {
      _id: result.insertedId,
      ...announcement,
    };

    // If marked important, push to all users
    if (isImportant) {
      // Trigger background push notification
      // Do not block response for push delivery
      sendPushNotificationToAll(
        `📢 ${title.trim()}`,
        content.trim().length > 100 ? `${content.trim().substring(0, 100)}...` : content.trim(),
        { type: 'announcement', announcementId: result.insertedId.toString() }
      ).catch(err => console.error('Error broadcasting announcement push notification:', err));
    }

    return NextResponse.json({ announcement: createdAnnouncement });
  } catch (error) {
    console.error('Error creating announcement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
