import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserFromToken } from '../../../../lib/eventAuthHelper';
import { sendEmail } from '../../../../lib/email';
import { sendPushNotification } from '../../../../lib/pushNotifications';

/**
 * Resolves the authenticated user from Bearer token (mobile) or cookie (web).
 */
async function getUser(request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : request.cookies.get('admin_token')?.value;
  return token ? await getUserFromToken(token) : null;
}

/**
 * Enriches a meeting document with computed fields and per-user RSVP status.
 */
function enrichMeeting(meeting, userEmail) {
  const now = new Date();
  const startTime = new Date(meeting.startTime);
  const endTime = meeting.endTime
    ? new Date(meeting.endTime)
    : new Date(startTime.getTime() + (meeting.duration || 30) * 60000);
  const myRsvp = (meeting.rsvps || []).find(
    (r) => r.email && r.email.toLowerCase() === (userEmail || '').toLowerCase()
  );
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
    useInterstitialJoin: !!meeting.useInterstitialJoin,
    redirectDelay: meeting.redirectDelay || 5,
    status: meeting.status || 'scheduled',
    momDocuments: meeting.momDocuments || [],
    isRecurring: !!meeting.seriesId,
    seriesId: meeting.seriesId || null,
    isInProgress: now >= startTime && now <= endTime,
    isPast: now > endTime,
    isUpcoming: now < startTime,
    reactions: meeting.reactions || [],
    rsvps: meeting.rsvps || [],
    myRsvp: myRsvp ? myRsvp.status : null,
    reminderSettings: meeting.reminderSettings || [],
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
    createdByBot: !!meeting.createdByBot,
    modifiedByBot: !!meeting.modifiedByBot,
    botOnBehalfOf: meeting.botOnBehalfOf || null,
  };
}

/**
 * GET /api/meetings/[id]
 * Returns a single meeting by ID.
 * RBAC: user must be host OR in participants array (case-insensitive).
 */
export async function GET(request, { params }) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    const { id } = await params;

    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid meeting ID.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const meeting = await db.collection('events').findOne({ _id: objectId });

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    }

    const userEmail = user.email.toLowerCase();
    const isHost = (meeting.host || '').toLowerCase() === userEmail;
    const isParticipant = (meeting.participants || []).some(
      (p) => p && p.toLowerCase() === userEmail
    );

    if (!isHost && !isParticipant) {
      return NextResponse.json({ error: 'Forbidden. You are not a participant of this meeting.' }, { status: 403 });
    }

    return NextResponse.json({ success: true, meeting: enrichMeeting(meeting, user.email) });
  } catch (error) {
    console.error('[GET /api/meetings/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch meeting.' }, { status: 500 });
  }
}

/**
 * PATCH /api/meetings/[id]
 * Updates the meeting's status field.
 * Body: { status: string }
 * RBAC: must be host.
 */
export async function PATCH(request, { params }) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    const { id } = await params;

    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid meeting ID.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const meeting = await db.collection('events').findOne({ _id: objectId });

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    }

    const isHost = (meeting.host || '').toLowerCase() === user.email.toLowerCase();
    if (!isHost) {
      return NextResponse.json({ error: 'Forbidden. Only the host can update this meeting.' }, { status: 403 });
    }

    const body = await request.json();
    const { status, title, description, startTime, duration, joinUrl, provider, participants } = body;

    const updateDoc = { updatedAt: new Date() };

    if (status !== undefined) {
      const allowedStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json({ error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` }, { status: 400 });
      }
      updateDoc.status = status;
    }

    if (title !== undefined) updateDoc.title = title.trim();
    if (description !== undefined) updateDoc.description = description ? description.trim() : '';
    if (startTime !== undefined) updateDoc.startTime = startTime;
    if (duration !== undefined) updateDoc.duration = Number(duration);
    if (joinUrl !== undefined) updateDoc.joinUrl = joinUrl ? joinUrl.trim() : '';
    if (provider !== undefined) updateDoc.provider = provider;
    if (participants !== undefined) updateDoc.participants = participants;

    // Check if postponed (startTime changed)
    const isTimeChanged = startTime && meeting.startTime && new Date(startTime).getTime() !== new Date(meeting.startTime).getTime();

    const result = await db.collection('events').findOneAndUpdate(
      { _id: objectId },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );

    // If time changed, trigger notifications asynchronously (fire-and-forget)
    if (isTimeChanged) {
      ;(async () => {
        try {
          const allParticipants = participants || meeting.participants || [];
          const updatedTitle = title || meeting.title;
          const updatedJoinUrl = joinUrl || meeting.joinUrl || meeting.zoomMeetingUrl;
          const updatedProvider = provider || meeting.provider;

          const oldDate = new Date(meeting.startTime);
          const newDate = new Date(startTime);

          const oldDateStr = oldDate.toLocaleString('en-IN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata',
          });

          const newDateStr = newDate.toLocaleString('en-IN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata',
          });

          // Send push notifications
          for (const participantEmail of allParticipants) {
            try {
              const participantUser = await db.collection('admin_users').findOne(
                { email: { $regex: `^${participantEmail}$`, $options: 'i' } },
                { projection: { _id: 1 } }
              );
              if (participantUser) {
                await sendPushNotification(
                  participantUser._id.toString(),
                  '📅 Meeting Postponed',
                  `"${updatedTitle}" rescheduled to ${newDateStr} (was ${oldDateStr})`,
                  { type: 'meeting_postponed', meetingId: id }
                );

                // Insert into admin_notifications for the user's mobile screen
                await db.collection('admin_notifications').insertOne({
                  id: `meet_postponed_${id}_${participantUser._id.toString()}_${Date.now()}`,
                  type: 'meeting_postponed',
                  severity: 'medium',
                  timestamp: new Date().toISOString(),
                  acknowledged: false,
                  acknowledgedAt: null,
                  acknowledgedBy: null,
                  targetUser: participantEmail.toLowerCase(),
                  data: {
                    title: '📅 Meeting Postponed',
                    message: `Meeting "${updatedTitle}" has been rescheduled to ${newDateStr} (was ${oldDateStr}).`,
                    meetingId: id
                  },
                  createdAt: new Date()
                }).catch(() => {});
              }
            } catch (perUserErr) {
              console.error(`Push notify fail for ${participantEmail}:`, perUserErr.message);
            }
          }

          // Send emails
          for (const participantEmail of allParticipants) {
            try {
              const subject = `📅 Rescheduled: ${updatedTitle}`;
              const emailOptions = {
                host: meeting.host,
                participants: allParticipants,
                event: {
                  title: updatedTitle,
                  description: `This meeting timing has been updated.\n\n* **Old Time**: ${oldDateStr}\n* **New Time**: ${newDateStr}\n\n${description || meeting.description || ''}`,
                  startTime: startTime,
                  duration: duration || meeting.duration || 30,
                  provider: updatedProvider,
                  joinUrl: updatedJoinUrl
                }
              };
              await sendEmail(participantEmail, subject, emailOptions);
            } catch (perUserErr) {
              console.error(`Email send fail for ${participantEmail}:`, perUserErr.message);
            }
          }
        } catch (notifErr) {
          console.error('[PATCH /api/meetings/[id]] Notifications failed:', notifErr.message);
        }
      })();
    }

    return NextResponse.json({ success: true, meeting: enrichMeeting(result, user.email) });
  } catch (error) {
    console.error('[PATCH /api/meetings/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to update meeting.' }, { status: 500 });
  }
}

/**
 * DELETE /api/meetings/[id]
 * Cancels/Deletes a specific meeting.
 * RBAC: must be host.
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    const { id } = await params;

    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid meeting ID.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const meeting = await db.collection('events').findOne({ _id: objectId });

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    }

    const isHost = (meeting.host || '').toLowerCase() === user.email.toLowerCase();
    if (!isHost) {
      return NextResponse.json({ error: 'Forbidden. Only the host can cancel/delete this meeting.' }, { status: 403 });
    }

    await db.collection('events').deleteOne({ _id: objectId });

    return NextResponse.json({ success: true, message: 'Meeting deleted successfully.' });
  } catch (error) {
    console.error('[DELETE /api/meetings/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to cancel meeting.' }, { status: 500 });
  }
}
