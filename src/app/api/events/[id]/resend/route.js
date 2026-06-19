import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserFromToken } from '../../../../../lib/eventAuthHelper';
import { sendEmail } from '../../../../../lib/email';
import crypto from 'crypto';

// POST /api/events/[id]/resend - Resend meeting invite notifications (host/admin only, rate limited)
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    const event = await db.collection('events').findOne({ _id: new ObjectId(id) });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Authorization check: Only hosts, console admins, and admins can resend invite notifications
    const isHost = (event.host || '').toLowerCase() === user.email.toLowerCase();
    const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
    if (!isHost && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden. Only the host or an administrator can resend notifications.' }, { status: 403 });
    }

    // Rate limiting check: Maximum 3 resends per 15 minutes
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const recentResends = (event.resendHistory || []).map(t => new Date(t)).filter(t => t > fifteenMinutesAgo);

    if (recentResends.length >= 3) {
      return NextResponse.json({
        error: 'Rate limit exceeded. You can only resend notifications 3 times per 15 minutes.'
      }, { status: 429 });
    }

    // Ensure participants array is present
    const participants = Array.isArray(event.participants) ? event.participants : [];
    if (participants.length === 0) {
      return NextResponse.json({ error: 'No participants are invited to this meeting.' }, { status: 400 });
    }

    // Verify or generate tracking tokens for participants if they don't exist
    let updatedTracking = Array.isArray(event.tracking) ? event.tracking : [];
    let trackingModified = false;

    for (const participantEmail of participants) {
      let tokenEntry = updatedTracking.find(t => t.email === participantEmail);
      if (!tokenEntry) {
        tokenEntry = {
          email: participantEmail,
          token: crypto.randomBytes(16).toString('hex'),
          sentAt: now,
        };
        updatedTracking.push(tokenEntry);
        trackingModified = true;
      }
    }

    // Update resend history and tracking in MongoDB
    const updatedHistory = [...recentResends, now];
    const updateDoc = {
      $set: {
        resendHistory: updatedHistory
      }
    };
    if (trackingModified) {
      updateDoc.$set.tracking = updatedTracking;
    }

    await db.collection('events').updateOne({ _id: new ObjectId(id) }, updateDoc);

    // Send email notifications
    const subject = `Reminder: You're invited to: ${event.title}`;
    const absoluteBase = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    
    const trackOpens = event.trackOpens !== false;
    const trackAck = event.trackAck !== false;

    let successCount = 0;
    let failureCount = 0;

    for (const participantEmail of participants) {
      try {
        const tokenEntry = updatedTracking.find(t => t.email === participantEmail);
        const openPixelUrl = trackOpens && tokenEntry ? `${absoluteBase}/api/events/${event._id}/track/open?token=${tokenEntry.token}` : undefined;
        const interstitialUrl = `${absoluteBase}/meet/join/${event._id}?meetingUrl=${encodeURIComponent(event.joinUrl)}&email=${encodeURIComponent(participantEmail)}&delay=${encodeURIComponent(event.redirectDelay || 5)}`;
        const buttonUrl = event.useInterstitialJoin ? interstitialUrl : (event.joinUrl || '');
        const trackedJoinUrl = buttonUrl;
        const ackUrl = trackAck && tokenEntry ? `${absoluteBase}/api/events/${event._id}/track/ack?token=${tokenEntry.token}` : undefined;
        const icsUrl = `${absoluteBase}/api/events/${event._id}/ics`;

        const emailOptions = {
          host: event.host,
          event: {
            title: event.title,
            description: event.description,
            startTime: event.startTime,
            duration: event.duration,
            zoomMeetingUrl: event.zoomMeetingUrl,
            joinUrl: event.joinUrl,
            provider: event.provider,
          },
          participants: event.participants,
          teams: event.teams || [],
          openPixelUrl,
          trackedJoinUrl,
          ackUrl,
          icsUrl,
          includeDirectMeetingLink: !!event.includeDirectMeetingLink,
        };

        await sendEmail(participantEmail, subject, emailOptions);
        successCount++;
      } catch (emailError) {
        console.error(`Failed to send reminder email to ${participantEmail}:`, emailError.message);
        failureCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully resent notifications to ${successCount} participant(s).${failureCount > 0 ? ` Failed to send to ${failureCount} participant(s).` : ''}`,
      resendsRemaining: 3 - updatedHistory.length
    });

  } catch (error) {
    console.error('Failed to resend notifications:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
