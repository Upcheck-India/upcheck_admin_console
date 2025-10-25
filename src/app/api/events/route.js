import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { createZoomMeeting } from '../../../lib/zoom';
import { sendEmail } from '../../../lib/email';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

// Helper function to get user from token
async function getUserFromToken(token) {
    if (!token) return null;

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne(
        { sessionToken: token },
        {
            projection: {
                _id: 1,
                email: 1,
                name: 1,
                role: 1,
            }
        }
    );
    return user;
}


// GET /api/events
export async function GET(request) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");

    const events = await db.collection('events').find({}).sort({ startTime: 1 }).toArray();

    return NextResponse.json(events);
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
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    const { title, description, participants, startTime, duration, sendNotification, zoomSettings, provider = 'zoom', joinUrl, includeAgenda = true, includeParticipants = true, includeNotes = false, notes = '', trackOpens = false, trackClicks = false, trackAck = false } = await request.json();

    if (!title || !description || !startTime || !duration) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
        startTime: new Date(startTime),
        endTime: new Date(new Date(startTime).getTime() + parseInt(duration, 10) * 60000),
        sendNotification: !!sendNotification,
        createdAt: new Date(),
        zoomSettings,
        provider,
        trackOpens: !!trackOpens,
        trackClicks: !!trackClicks,
        trackAck: !!trackAck,
    };

    if (provider === 'zoom') {
      const zoomMeeting = await createZoomMeeting(eventData);
      eventData.zoomMeetingUrl = zoomMeeting.join_url;
      eventData.zoomMeetingId = zoomMeeting.id;
      eventData.joinUrl = zoomMeeting.join_url;
    } else {
      if (!joinUrl || typeof joinUrl !== 'string') {
        return NextResponse.json({ error: 'Google Meet link (joinUrl) is required for Google Meet provider' }, { status: 400 });
      }
      eventData.joinUrl = joinUrl;
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

    if (eventData.sendNotification && eventData.participants.length > 0) {
      const subject = `You're invited to: ${eventData.title}`;
      const absoluteBase = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
      for (const participantEmail of eventData.participants) {
        const tokenEntry = (eventData.tracking || []).find(t => t.email === participantEmail);
        const openPixelUrl = trackOpens && tokenEntry ? `${absoluteBase}/api/events/${eventData._id}/track/open?token=${tokenEntry.token}` : undefined;
        const trackedJoinUrl = trackClicks && tokenEntry ? `${absoluteBase}/api/events/${eventData._id}/track/click?token=${tokenEntry.token}` : undefined;
        const ackUrl = trackAck && tokenEntry ? `${absoluteBase}/api/events/${eventData._id}/track/ack?token=${tokenEntry.token}` : undefined;

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
          notes: includeNotes ? notes : undefined,
          openPixelUrl,
          trackedJoinUrl,
          ackUrl,
        };

        await sendEmail(participantEmail, subject, emailOptions);
      }
    }

    return NextResponse.json({ ...eventData, _id: result.insertedId }, { status: 201 });

  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
