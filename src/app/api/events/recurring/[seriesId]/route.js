import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { validateRecurrencePattern, generateOccurrences } from '../../../../../lib/recurrence';
import { scheduleJob, cancelJob, getJobsBySeries } from '../../../../../lib/scheduler';
import { validateUpdateSeriesRequest } from '../../../../../lib/validation/recurring';
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

// GET /api/events/recurring/[seriesId] - Get specific recurring series
export async function GET(request, { params }) {
  try {
    const { seriesId } = await params;
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ObjectId.isValid(seriesId)) {
      return NextResponse.json({ error: 'Invalid series ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    const series = await db.collection('recurring_series').findOne({ 
      _id: new ObjectId(seriesId),
      hostId: user._id.toString()
    });

    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    return NextResponse.json(series);
  } catch (error) {
    console.error('Error fetching recurring series:', error);
    return NextResponse.json({ error: 'Failed to fetch recurring series' }, { status: 500 });
  }
}

// PUT /api/events/recurring/[seriesId] - Update recurring series
export async function PUT(request, { params }) {
  try {
    const { seriesId } = await params;
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ObjectId.isValid(seriesId)) {
      return NextResponse.json({ error: 'Invalid series ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Find the series to check ownership
    const series = await db.collection('recurring_series').findOne({ 
      _id: new ObjectId(seriesId),
      hostId: user._id.toString()
    });

    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    const body = await request.json();
    
    // Validate request body
    const validation = validateUpdateSeriesRequest(body);
    if (!validation.isValid) {
        return NextResponse.json({ 
          error: 'Validation failed',
          details: validation.errors
        }, { status: 400 });
    }

    const {
      title,
      description,
      participants,
      duration,
      recurrencePattern,
      reminderSettings,
      seriesNotification,
      trackOpens,
      trackClicks,
      trackAck,
      useInterstitialJoin,
      redirectDelay,
      includeDirectMeetingLink,
      applyToFutureOnly = true
    } = body;

    const updateData = {
      updatedAt: new Date()
    };

    // Update basic fields if provided
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (participants !== undefined) updateData.participants = participants;
    if (reminderSettings !== undefined) updateData.reminderSettings = reminderSettings;
    if (seriesNotification !== undefined) updateData.seriesNotification = seriesNotification;
    if (trackOpens !== undefined) updateData.trackOpens = !!trackOpens;
    if (trackClicks !== undefined) updateData.trackClicks = !!trackClicks;
    if (trackAck !== undefined) updateData.trackAck = !!trackAck;
    if (useInterstitialJoin !== undefined) updateData.useInterstitialJoin = !!useInterstitialJoin;
    if (redirectDelay !== undefined) updateData.redirectDelay = Math.max(0, Number(redirectDelay) || 0);
    if (includeDirectMeetingLink !== undefined) updateData.includeDirectMeetingLink = !!includeDirectMeetingLink;

    // Validate duration if provided
    if (duration !== undefined) {
      const durationInt = parseInt(duration, 10);
      if (isNaN(durationInt) || durationInt < 1 || durationInt > 300) {
          return NextResponse.json({ 
            error: 'Duration must be between 1 and 300 minutes' 
          }, { status: 400 });
      }
      updateData.duration = durationInt;
    }

    // Validate and update recurrence pattern if provided
    if (recurrencePattern) {
      const validation = validateRecurrencePattern(recurrencePattern);
      if (!validation.isValid) {
          return NextResponse.json({ 
            error: `Invalid recurrence pattern: ${validation.errors.join(', ')}` 
          }, { status: 400 });
      }
      updateData.recurrencePattern = recurrencePattern;
      
      // If pattern changed, we need to regenerate future meetings
      updateData.nextGenerationDate = new Date();
    }

    // Update the series
    const updateResult = await db.collection('recurring_series').updateOne(
      { _id: new ObjectId(seriesId) },
      { $set: updateData }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    // If recurrence pattern changed, cancel existing generation jobs and schedule new ones
    if (recurrencePattern) {
      try {
        const existingJobs = await getJobsBySeries(seriesId, 'pending');
        for (const job of existingJobs) {
          if (job.type === 'generate_meeting') {
            await cancelJob(job._id);
          }
        }

        // Schedule new generation job
        await scheduleJob('generate_meeting', {
          seriesId: seriesId,
          generateUntil: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 days ahead
        }, new Date());
      } catch (jobError) {
        console.error('Error updating scheduled jobs:', jobError);
        // Non-fatal error, continue with response
      }
    }

    // Get updated series
    const updatedSeries = await db.collection('recurring_series').findOne({ 
      _id: new ObjectId(seriesId) 
    });

    return NextResponse.json(updatedSeries);

  } catch (error) {
    console.error('Error updating recurring series:', error);
    return NextResponse.json({ error: 'Failed to update recurring series' }, { status: 500 });
  }
}

// DELETE /api/events/recurring/[seriesId] - Delete recurring series
export async function DELETE(request, { params }) {
  try {
    const { seriesId } = await params;
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ObjectId.isValid(seriesId)) {
      return NextResponse.json({ error: 'Invalid series ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Find the series to check ownership
    const series = await db.collection('recurring_series').findOne({ 
      _id: new ObjectId(seriesId),
      hostId: user._id.toString()
    });

    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const cancelFutureOnly = url.searchParams.get('cancelFutureOnly') === 'true';

    if (cancelFutureOnly) {
      // Mark series as inactive and cancel future jobs
      await db.collection('recurring_series').updateOne(
        { _id: new ObjectId(seriesId) },
        { 
          $set: { 
            isActive: false,
            updatedAt: new Date()
          }
        }
      );

      // Cancel pending jobs
      try {
        const pendingJobs = await getJobsBySeries(seriesId, 'pending');
        for (const job of pendingJobs) {
          await cancelJob(job._id);
        }
      } catch (jobError) {
        console.error('Error cancelling jobs:', jobError);
      }

      return NextResponse.json({ 
        message: 'Series deactivated and future meetings cancelled' 
      });
    } else {
      // Delete the entire series
      const deleteResult = await db.collection('recurring_series').deleteOne({ 
        _id: new ObjectId(seriesId) 
      });

      if (deleteResult.deletedCount === 0) {
          return NextResponse.json({ 
            error: 'Series not found or already deleted' 
          }, { status: 404 });
      }

      // Cancel all related jobs
      try {
        const allJobs = await getJobsBySeries(seriesId);
        for (const job of allJobs) {
          if (job.status === 'pending') {
            await cancelJob(job._id);
          }
        }
      } catch (jobError) {
        console.error('Error cancelling jobs:', jobError);
      }

      // TODO: Also delete or mark related events as cancelled
      // This would be implemented when we have the full event integration

      return NextResponse.json({ 
        message: 'Series deleted successfully' 
      });
    }

  } catch (error) {
    console.error('Error deleting recurring series:', error);
    return NextResponse.json({ error: 'Failed to delete recurring series' }, { status: 500 });
  }
}