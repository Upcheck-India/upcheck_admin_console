import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { createZoomMeeting } from '../../../lib/zoom';
import { sendEmail } from '../../../lib/email';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { getUserFromToken } from '../../../lib/eventAuthHelper';
import { sendPushNotification } from '../../../lib/pushNotifications';

// GET /api/events
export async function GET(request) {
  try {
    // --- Bug Fix #1.7: Auth guard added — was fully public before ---
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Get URL parameters
    const { searchParams } = new URL(request.url);
    const includeRecurring = searchParams.get('includeRecurring') === 'true';

    // Fetch individual events
    const events = await db.collection('events').find({}).sort({ startTime: 1 }).toArray();

    if (!includeRecurring) {
      return NextResponse.json(events);
    }

    // Fetch recurring series
    const recurringSeries = await db.collection('recurring_series')
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .toArray();

    // Transform recurring series to look like events for display
    const seriesAsEvents = recurringSeries.map(series => ({
      ...series,
      _id: series._id,
      title: `🔄 ${series.title}`, // Add recurring indicator
      description: series.description,
      startTime: series.nextGenerationDate || series.createdAt,
      endTime: null,
      participants: series.participants || [],
      duration: series.duration,
      provider: series.provider,
      isRecurringSeries: true, // Flag to identify recurring series
      totalInstances: series.totalInstances || 0,
      completedInstances: series.completedInstances || 0,
    }));

    // Combine and sort all items
    const allItems = [...events, ...seriesAsEvents].sort((a, b) =>
      new Date(a.startTime) - new Date(b.startTime)
    );

    return NextResponse.json(allItems);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

// POST /api/events
export async function POST(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;

    const user = await getUserFromToken(token);

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    const { title, description, participants, teams = [], startTime, duration, sendNotification, zoomSettings, provider = 'zoom', joinUrl, includeAgenda = true, includeParticipants = true, includeNotes = false, notes = '', trackOpens = false, trackClicks = false, trackAck = false, inviteUpcheckBot = false, useInterstitialJoin = true, redirectDelay = 5, includeDirectMeetingLink = true } = await request.json();

    if (!title || !description || !startTime || !duration) {
        return NextResponse.json({ error: 'Missing required fields: title, description, startTime, and duration are required.' }, { status: 400 });
    }

    // Validate duration range (1-300 minutes)
    const durationInt = parseInt(duration, 10);
    if (isNaN(durationInt) || durationInt < 1 || durationInt > 300) {
        return NextResponse.json({ error: 'Duration must be between 1 and 300 minutes' }, { status: 400 });
    }

    // Ensure startTime is in the future
    if (new Date(startTime) < new Date()) {
        return NextResponse.json({ error: 'Start time must be in the future' }, { status: 400 });
    }

    const eventId = new ObjectId();
    const eventData = {
        _id: eventId,
        title,
        description,
        host: user.email,
        hostId: user._id.toString(),
        duration: parseInt(duration, 10),
        participants: participants || [],
        teams: teams || [],
        startTime: new Date(startTime),
        endTime: new Date(new Date(startTime).getTime() + parseInt(duration, 10) * 60000),
        sendNotification: !!sendNotification,
        createdAt: new Date(),
        zoomSettings,
        provider,
        trackOpens: !!trackOpens,
        trackClicks: !!trackClicks,
        trackAck: !!trackAck,
        inviteUpcheckBot: !!inviteUpcheckBot,
        useInterstitialJoin: !!useInterstitialJoin,
        redirectDelay: Math.max(0, Number(redirectDelay) || 0),
        includeDirectMeetingLink: !!includeDirectMeetingLink,
    };

    // Handle meeting provider
    if (provider === 'zoom') {
      try {
        const zoomMeeting = await createZoomMeeting(eventData);
        eventData.zoomMeetingUrl = zoomMeeting.join_url;
        eventData.zoomMeetingId = zoomMeeting.id;
        eventData.joinUrl = zoomMeeting.join_url;
      } catch (zoomError) {
        console.error('Zoom meeting creation failed:', zoomError.message);
        // Return specific error for Zoom failure
        return NextResponse.json({
          error: 'Failed to create Zoom meeting. Please check Zoom API credentials or try using Google Meet instead.',
          details: zoomError.message
        }, { status: 500 });
      }
    } else if (provider === 'google_meet') {
      if (!joinUrl || typeof joinUrl !== 'string') {
        return NextResponse.json({ error: 'Google Meet link (joinUrl) is required for Google Meet provider' }, { status: 400 });
      }
      eventData.joinUrl = joinUrl;
    } else {
      return NextResponse.json({ error: 'Invalid meeting provider. Use "zoom" or "google_meet".' }, { status: 400 });
    }

    // If sending notifications, generate tracking tokens per recipient
    if (eventData.sendNotification && eventData.participants.length > 0 && (trackOpens || trackClicks || trackAck)) {
      eventData.tracking = eventData.participants.map(email => ({
        email,
        token: crypto.randomBytes(16).toString('hex'),
        sentAt: new Date(),
      }));
    }

    const result = await db.collection('events').insertOne(eventData);

    // Send email notifications
    if (eventData.sendNotification && eventData.participants.length > 0) {
      const subject = `You're invited to: ${eventData.title}`;
      const absoluteBase = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;

      for (const participantEmail of eventData.participants) {
        try {
          const tokenEntry = (eventData.tracking || []).find(t => t.email === participantEmail);
          const openPixelUrl = trackOpens && tokenEntry ? `${absoluteBase}/api/events/${eventData._id}/track/open?token=${tokenEntry.token}` : undefined;
          const interstitialUrl = `${absoluteBase}/meet/join/${eventData._id}?meetingUrl=${encodeURIComponent(eventData.joinUrl)}&email=${encodeURIComponent(participantEmail)}&delay=${encodeURIComponent(eventData.redirectDelay || 5)}`;
          const buttonUrl = eventData.useInterstitialJoin ? interstitialUrl : (eventData.joinUrl || '');
          const trackedJoinUrl = buttonUrl;
          const ackUrl = trackAck && tokenEntry ? `${absoluteBase}/api/events/${eventData._id}/track/ack?token=${tokenEntry.token}` : undefined;
          const icsUrl = `${absoluteBase}/api/events/${eventData._id}/ics`;

          const emailOptions = {
            host: eventData.host,
            event: {
              title: eventData.title,
              description: includeAgenda ? eventData.description : undefined,
              startTime: eventData.startTime,
              duration: eventData.duration,
              zoomMeetingUrl: eventData.zoomMeetingUrl,
              joinUrl: eventData.joinUrl,
              provider: eventData.provider,
            },
            participants: includeParticipants ? eventData.participants : undefined,
            teams: eventData.teams || [],
            notes: includeNotes ? notes : undefined,
            openPixelUrl,
            trackedJoinUrl,
            ackUrl,
            icsUrl,
            includeDirectMeetingLink: !!eventData.includeDirectMeetingLink,
          };

          await sendEmail(participantEmail, subject, emailOptions);
        } catch (emailError) {
          console.error(`Failed to send email to ${participantEmail}:`, emailError.message);
          // Continue with other recipients even if one fails
        }
      }
    }

    // If requested, schedule the Upcheck bot to join the meeting at start time (Google Meet only)
    try {
      if (eventData.provider === 'google_meet' && eventData.inviteUpcheckBot && eventData.joinUrl) {
        const botUrl = process.env.UPCHECK_BOT_URL;
        if (botUrl) {
          await fetch(`${botUrl.replace(/\/$/, '')}/api/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventId: eventData._id,
              meetingUrl: eventData.joinUrl,
              startTime: eventData.startTime,
              displayName: 'Upcheck Bot',
              options: { muteAudio: true, disableVideo: true }
            })
          });
        } else {
          console.warn('UPCHECK_BOT_URL not set; skipping bot scheduling');
        }
      }
    } catch (e) {
      console.error('Failed to schedule bot join:', e);
      // Non-fatal
    }

    // Fire-and-forget: send push notifications to all participants on meeting creation
    ;(async () => {
      try {
        const allParticipants = eventData.participants || [];
        if (allParticipants.length === 0) return;

        const pushClient = await clientPromise;
        const pushDb = pushClient.db('resources');

        const meetingDate = new Date(eventData.startTime);
        const dateStr = meetingDate.toLocaleString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata',
        });

        for (const participantEmail of allParticipants) {
          try {
            const participantUser = await pushDb.collection('admin_users').findOne(
              { email: { $regex: `^${participantEmail}$`, $options: 'i' } },
              { projection: { _id: 1 } }
            );
            if (!participantUser) continue;

            await sendPushNotification(
              participantUser._id.toString(),
              '📅 New Meeting Scheduled',
              `${eventData.title} on ${dateStr}`,
              { type: 'new_meeting', meetingId: result.insertedId.toString() }
            );
          } catch (perUserErr) {
            console.error(`[events POST] Push notification failed for ${participantEmail}:`, perUserErr.message);
          }
        }
      } catch (pushErr) {
        console.error('[events POST] Push notification block failed:', pushErr.message);
      }
    })();

    return NextResponse.json({ ...eventData, _id: result.insertedId }, { status: 201 });

  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({
      error: 'Failed to create event',
      details: error.message || 'Unknown error'
    }, { status: 500 });
  }
}
