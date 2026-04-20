import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { createZoomMeeting } from '../../../../../lib/zoom';
import { sendEmail } from '../../../../../lib/email';
import { validateUpdateInstanceRequest } from '../../../../../lib/validation/recurring';
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

// PUT /api/events/[id]/instance - Update individual instance
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Find the event instance
    const event = await db.collection('events').findOne({ 
      _id: new ObjectId(id),
      host: user.email
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.seriesId) {
      return NextResponse.json({ 
        error: 'This is not a recurring meeting instance' 
      }, { status: 400 });
    }

    const body = await request.json();
    
    // Validate request body
    const validation = validateUpdateInstanceRequest(body);
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
      startTime,
      duration,
      applyToFuture = false, // Apply changes to this and all future instances
      sendNotification = false
    } = body;

    const updateData = {
      updatedAt: new Date()
    };

    // Mark as modified if any changes are made
    let hasChanges = false;

    if (title !== undefined && title !== event.title) {
      updateData['overrides.title'] = title;
      updateData.title = title;
      hasChanges = true;
    }

    if (description !== undefined && description !== event.description) {
      updateData['overrides.description'] = description;
      updateData.description = description;
      hasChanges = true;
    }

    if (participants !== undefined && JSON.stringify(participants) !== JSON.stringify(event.participants)) {
      updateData['overrides.participants'] = participants;
      updateData.participants = participants;
      hasChanges = true;
    }

    if (duration !== undefined) {
      const durationInt = parseInt(duration, 10);
      if (isNaN(durationInt) || durationInt < 1 || durationInt > 300) {
          return NextResponse.json({ 
            error: 'Duration must be between 1 and 300 minutes' 
          }, { status: 400 });
      }
      if (durationInt !== event.duration) {
        updateData['overrides.duration'] = durationInt;
        updateData.duration = durationInt;
        updateData.endTime = new Date(new Date(startTime || event.startTime).getTime() + durationInt * 60000);
        hasChanges = true;
      }
    }

    if (startTime !== undefined) {
      const newStartTime = new Date(startTime);
      if (newStartTime.getTime() !== event.startTime.getTime()) {
        updateData.startTime = newStartTime;
        updateData.endTime = new Date(newStartTime.getTime() + (duration || event.duration) * 60000);
        updateData['recurrenceInstance.originalDate'] = event.recurrenceInstance?.originalDate || event.startTime;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      updateData['recurrenceInstance.wasModified'] = true;
      updateData['recurrenceInstance.modificationReason'] = 'Instance-specific changes';
    }

    if (!hasChanges) {
      return NextResponse.json({ 
        message: 'No changes detected',
        event 
      });
    }

    // Update this instance
    await db.collection('events').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // If applyToFuture is true, update all future instances in the series
    if (applyToFuture && event.seriesId) {
      const futureUpdateData = {};
      
      if (title !== undefined) futureUpdateData.title = title;
      if (description !== undefined) futureUpdateData.description = description;
      if (participants !== undefined) futureUpdateData.participants = participants;
      if (duration !== undefined) {
        futureUpdateData.duration = parseInt(duration, 10);
        // Note: We don't update endTime for future events as their startTime might be different
      }

      if (Object.keys(futureUpdateData).length > 0) {
        futureUpdateData.updatedAt = new Date();
        
        await db.collection('events').updateMany(
          { 
            seriesId: event.seriesId,
            startTime: { $gt: event.startTime },
            'recurrenceInstance.isCancelled': { $ne: true }
          },
          { $set: futureUpdateData }
        );
      }

      // Also update the series template for future generated instances
      const seriesUpdateData = {};
      if (title !== undefined) seriesUpdateData.title = title;
      if (description !== undefined) seriesUpdateData.description = description;
      if (participants !== undefined) seriesUpdateData.participants = participants;
      if (duration !== undefined) seriesUpdateData.duration = parseInt(duration, 10);

      if (Object.keys(seriesUpdateData).length > 0) {
        seriesUpdateData.updatedAt = new Date();
        
        await db.collection('recurring_series').updateOne(
          { _id: event.seriesId },
          { $set: seriesUpdateData }
        );
      }
    }

    // Send notifications if requested
    if (sendNotification && participants && participants.length > 0) {
      const updatedEvent = await db.collection('events').findOne({ _id: new ObjectId(id) });
      
      const subject = `Meeting Updated: ${updatedEvent.title}`;
      const absoluteBase = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
      
      for (const participantEmail of participants) {
        const interstitialUrl = `${absoluteBase}/meet/join/${updatedEvent._id}?meetingUrl=${encodeURIComponent(updatedEvent.joinUrl)}&email=${encodeURIComponent(participantEmail)}&delay=${encodeURIComponent(updatedEvent.redirectDelay || 5)}`;
        const buttonUrl = updatedEvent.useInterstitialJoin ? interstitialUrl : (updatedEvent.joinUrl || '');
        const icsUrl = `${absoluteBase}/api/events/${updatedEvent._id}/ics`;

        const emailOptions = {
          host: updatedEvent.host,
          event: {
            title: updatedEvent.title,
            description: updatedEvent.description,
            startTime: updatedEvent.startTime,
            duration: updatedEvent.duration,
            joinUrl: updatedEvent.joinUrl,
            provider: updatedEvent.provider,
          },
          participants: updatedEvent.participants,
          trackedJoinUrl: buttonUrl,
          icsUrl,
          includeDirectMeetingLink: !!updatedEvent.includeDirectMeetingLink,
          isUpdate: true
        };

        await sendEmail(participantEmail, subject, emailOptions);
      }
    }

    // Get the updated event
    const updatedEvent = await db.collection('events').findOne({ _id: new ObjectId(id) });

    return NextResponse.json({
      message: 'Instance updated successfully',
      event: updatedEvent,
      appliedToFuture: applyToFuture
    });

  } catch (error) {
    console.error('Error updating event instance:', error);
    return NextResponse.json({ error: 'Failed to update event instance' }, { status: 500 });
  }
}

// DELETE /api/events/[id]/instance - Cancel individual instance
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Find the event instance
    const event = await db.collection('events').findOne({ 
      _id: new ObjectId(id),
      host: user.email
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.seriesId) {
      return NextResponse.json({ 
        error: 'This is not a recurring meeting instance' 
      }, { status: 400 });
    }

    const url = new URL(request.url);
    const cancelFuture = url.searchParams.get('cancelFuture') === 'true';
    const sendNotification = url.searchParams.get('sendNotification') === 'true';

    // Cancel this instance
    await db.collection('events').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          'recurrenceInstance.isCancelled': true,
          'recurrenceInstance.modificationReason': 'Cancelled by organizer',
          updatedAt: new Date()
        }
      }
    );

    let cancelledCount = 1;

    // Cancel future instances if requested
    if (cancelFuture) {
      const result = await db.collection('events').updateMany(
        { 
          seriesId: event.seriesId,
          startTime: { $gt: event.startTime },
          'recurrenceInstance.isCancelled': { $ne: true }
        },
        { 
          $set: { 
            'recurrenceInstance.isCancelled': true,
            'recurrenceInstance.modificationReason': 'Cancelled with future instances',
            updatedAt: new Date()
          }
        }
      );
      cancelledCount += result.modifiedCount;

      // Also deactivate the series
      await db.collection('recurring_series').updateOne(
        { _id: event.seriesId },
        { 
          $set: { 
            isActive: false,
            updatedAt: new Date()
          }
        }
      );
    }

    // Update series statistics
    await db.collection('recurring_series').updateOne(
      { _id: event.seriesId },
      { 
        $inc: { cancelledInstances: cancelledCount },
        $set: { updatedAt: new Date() }
      }
    );

    // Send cancellation notifications if requested
    if (sendNotification && event.participants && event.participants.length > 0) {
      const subject = `Meeting Cancelled: ${event.title}`;
      
      for (const participantEmail of event.participants) {
        const emailOptions = {
          host: event.host,
          event: {
            title: event.title,
            description: event.description,
            startTime: event.startTime,
            duration: event.duration,
          },
          isCancellation: true,
          cancelledFuture: cancelFuture
        };

        await sendEmail(participantEmail, subject, emailOptions);
      }
    }

    return NextResponse.json({
      message: `Successfully cancelled ${cancelledCount} meeting instance(s)`,
      cancelledCount,
      cancelledFuture: cancelFuture
    });

  } catch (error) {
    console.error('Error cancelling event instance:', error);
    return NextResponse.json({ error: 'Failed to cancel event instance' }, { status: 500 });
  }
}