import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserFromToken } from '../../../../lib/eventAuthHelper';

/**
 * GET /api/meetings/my-meetings
 * Returns all meetings where the authenticated user is a participant or host.
 * Supports filtering by status (upcoming, past, all) and search.
 * This is the mobile-optimized endpoint with RBAC.
 */
export async function GET(request) {
  try {
    // Auth: check Bearer token (mobile) or cookie (web)
    const authHeader = request.headers.get('authorization');
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = request.cookies.get('admin_token')?.value;
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // 'upcoming', 'past', 'today', 'all'
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const userEmail = user.email.toLowerCase();

    // Build the query: user is host or in participants array (case-insensitive)
    const baseQuery = {
      status: { $ne: 'cancelled' },
      $or: [
        { host: { $regex: `^${userEmail}$`, $options: 'i' } },
        { participants: { $regex: userEmail, $options: 'i' } },
      ],
    };

    // Add time-based filters
    const now = new Date();
    if (filter === 'upcoming') {
      baseQuery.startTime = { $gte: now };
    } else if (filter === 'past') {
      baseQuery.startTime = { $lt: now };
    } else if (filter === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      baseQuery.startTime = { $gte: todayStart, $lte: todayEnd };
    }

    // Add search filter
    if (search) {
      baseQuery.$and = [
        baseQuery.$and ? { ...baseQuery } : {},
        {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ],
        },
      ];
      // Flatten: replace top-level $or + $and properly
      delete baseQuery.$and;
      const timeFilter = filter === 'upcoming' ? { $gte: now } : filter === 'past' ? { $lt: now } : filter === 'today' ? { $gte: new Date(new Date().setHours(0,0,0,0)), $lte: new Date(new Date().setHours(23,59,59,999)) } : undefined;
      
      const finalQuery = {
        status: { $ne: 'cancelled' },
        $or: [
          { host: { $regex: `^${userEmail}$`, $options: 'i' } },
          { participants: { $regex: userEmail, $options: 'i' } },
        ],
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ],
      };
      if (timeFilter) finalQuery.startTime = timeFilter;

      const total = await db.collection('events').countDocuments(finalQuery);
      const meetings = await db.collection('events')
        .find(finalQuery)
        .sort({ startTime: filter === 'past' ? -1 : 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      return NextResponse.json({
        success: true,
        meetings: meetings.map(enrichMeeting),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    }

    const total = await db.collection('events').countDocuments(baseQuery);
    const meetings = await db.collection('events')
      .find(baseQuery)
      .sort({ startTime: filter === 'past' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      meetings: meetings.map(enrichMeeting),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching my-meetings:', error);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}

/**
 * Enriches a meeting document for mobile response.
 * Adds computed fields like rsvpStatus, participantReactions, etc.
 */
function enrichMeeting(meeting) {
  const now = new Date();
  const startTime = new Date(meeting.startTime);
  const endTime = meeting.endTime ? new Date(meeting.endTime) : new Date(startTime.getTime() + (meeting.duration || 30) * 60000);

  return {
    _id: meeting._id.toString(),
    title: meeting.overrides?.title || meeting.title,
    description: meeting.overrides?.description || meeting.description,
    host: meeting.host,
    hostId: meeting.hostId,
    duration: meeting.overrides?.duration || meeting.duration,
    participants: meeting.overrides?.participants || meeting.participants || [],
    teams: meeting.overrides?.teams || meeting.teams || [],
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    provider: meeting.provider,
    joinUrl: meeting.joinUrl || meeting.zoomMeetingUrl,
    status: meeting.status || 'scheduled',
    momDocuments: meeting.momDocuments || [],
    isRecurring: !!meeting.seriesId,
    seriesId: meeting.seriesId || null,
    // Computed status
    isInProgress: now >= startTime && now <= endTime,
    isPast: now > endTime,
    isUpcoming: now < startTime,
    // Reactions & RSVP data
    reactions: meeting.reactions || [],
    rsvps: meeting.rsvps || [],
    // Reminder settings for this meeting (per-user)
    reminderSettings: meeting.reminderSettings || [],
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
  };
}
