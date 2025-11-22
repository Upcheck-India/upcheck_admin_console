import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { validateRecurrencePattern, generateOccurrences } from '../../../../lib/recurrence';
import { scheduleJob } from '../../../../lib/scheduler';
import { validateCreateSeriesRequest } from '../../../../lib/validation/recurring';
import { ObjectId } from 'mongodb';

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

// GET /api/events/recurring - Get all recurring series for the user
export async function GET(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    const series = await db.collection('recurring_series')
      .find({ hostId: user._id.toString() })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(series);
  } catch (error) {
    console.error('Error fetching recurring series:', error);
    return NextResponse.json({ error: 'Failed to fetch recurring series' }, { status: 500 });
  }
}

// POST /api/events/recurring - Create new recurring series
export async function POST(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    const body = await request.json();
    
    // Validate request body
    const validation = validateCreateSeriesRequest(body);
    if (!validation.isValid) {
        return NextResponse.json({ 
          error: 'Validation failed',
          details: validation.errors
        }, { status: 400 });
    }

    const {
      title,
      description,
      participants = [],
      startTime,
      duration,
      recurrencePattern,
      provider = 'zoom',
      zoomSettings,
      joinUrl,
      reminderSettings = [],
      seriesNotification = { enabled: true },
      trackOpens = false,
      trackClicks = false,
      trackAck = false,
      useInterstitialJoin = true,
      redirectDelay = 5,
      includeDirectMeetingLink = true
    } = body;

    const startDate = new Date(startTime);
    const durationInt = parseInt(duration, 10);

    // Generate initial occurrences to validate the pattern works
    try {
      const testOccurrences = generateOccurrences(recurrencePattern, startDate, 5);
      if (testOccurrences.length === 0) {
        return NextResponse.json({ 
          error: 'Recurrence pattern generates no future occurrences' 
        }, { status: 400 });
      }
    } catch (patternError) {
      return NextResponse.json({ 
        error: `Invalid recurrence pattern: ${patternError.message}` 
      }, { status: 400 });
    }

    // Create recurring series document
    const seriesId = new ObjectId();
    const seriesData = {
      _id: seriesId,
      title,
      description,
      host: user.email,
      hostId: user._id.toString(),
      duration: durationInt,
      participants,
      provider,
      zoomSettings,
      joinUrl,
      recurrencePattern,
      reminderSettings,
      seriesNotification,
      trackOpens: !!trackOpens,
      trackClicks: !!trackClicks,
      trackAck: !!trackAck,
      useInterstitialJoin: !!useInterstitialJoin,
      redirectDelay: Math.max(0, Number(redirectDelay) || 0),
      includeDirectMeetingLink: !!includeDirectMeetingLink,
      isActive: true,
      nextGenerationDate: startDate,
      totalInstances: 0,
      completedInstances: 0,
      cancelledInstances: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert the series
    const result = await db.collection('recurring_series').insertOne(seriesData);

    // Schedule initial meeting generation job
    await scheduleJob('generate_meeting', {
      seriesId: seriesId.toString(),
      generateUntil: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 days ahead
    }, new Date());

    // Schedule series notification if enabled
    if (seriesNotification.enabled && participants.length > 0) {
      await scheduleJob('send_series_notification', {
        seriesId: seriesId.toString()
      }, new Date());
    }

    return NextResponse.json({ 
      ...seriesData, 
      _id: result.insertedId 
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating recurring series:', error);
    return NextResponse.json({ error: 'Failed to create recurring series' }, { status: 500 });
  }
}