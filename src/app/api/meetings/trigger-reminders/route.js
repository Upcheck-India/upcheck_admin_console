import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { sendPushNotification } from '../../../../lib/pushNotifications';

/**
 * GET /api/meetings/trigger-reminders
 * Cron-style endpoint — no auth required.
 *
 * Scans meetings starting in the next 90 minutes, and for each participant
 * checks whether it's time to fire their reminder (default: 15 min before,
 * or custom minutesBefore from reminderSettings). Uses a ±1-minute send window
 * to avoid duplicate sends and persists reminderSentAt per user.
 *
 * Returns: { success: true, sent: number }
 */
export async function GET(request) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 90 * 60 * 1000); // now + 90 min

    // Fetch all meetings starting within the next 90 minutes that are not cancelled/completed
    const meetings = await db.collection('events').find({
      startTime: { $gte: now, $lte: windowEnd },
      status: { $nin: ['cancelled', 'completed'] },
    }).toArray();

    let totalSent = 0;

    for (const meeting of meetings) {
      const startTime = new Date(meeting.startTime).getTime();
      const participants = meeting.participants || [];
      const reminderSettings = meeting.reminderSettings || [];

      // Build a map of custom reminders keyed by email (lower-cased)
      const reminderMap = {};
      for (const setting of reminderSettings) {
        if (setting.email) {
          reminderMap[setting.email.toLowerCase()] = setting;
        }
      }

      // Collect all unique emails: participants + host
      const allEmails = new Set();
      for (const p of participants) {
        if (p) allEmails.add(p.toLowerCase());
      }
      if (meeting.host) allEmails.add(meeting.host.toLowerCase());

      for (const email of allEmails) {
        const userSetting = reminderMap[email] || null;
        const minutesBefore = userSetting?.minutesBefore ?? 15; // default 15 min
        const reminderSentAt = userSetting?.reminderSentAt || null;

        // Skip if reminder was already sent for this meeting
        if (reminderSentAt) continue;

        // Check ±1-minute send window
        const reminderTime = startTime - minutesBefore * 60 * 1000;
        const nowMs = Date.now();
        const withinWindow = nowMs >= reminderTime - 60000 && nowMs <= reminderTime + 60000;

        if (!withinWindow) continue;

        // Look up the user by email to get their userId for push notification
        const userDoc = await db.collection('admin_users').findOne(
          { email: { $regex: `^${email}$`, $options: 'i' } },
          { projection: { _id: 1, name: 1, expoPushToken: 1 } }
        );

        if (!userDoc) continue;

        // Format date for the notification body
        const meetingDate = new Date(meeting.startTime);
        const dateStr = meetingDate.toLocaleString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata',
        });

        const title = '⏰ Meeting Reminder';
        const body = `${meeting.title} starts in ${minutesBefore} min (${dateStr})`;
        const data = {
          type: 'meeting_reminder',
          meetingId: meeting._id.toString(),
          minutesBefore,
        };

        try {
          await sendPushNotification(userDoc._id.toString(), title, body, data);
          totalSent++;
        } catch (pushErr) {
          console.error(`[trigger-reminders] Push failed for ${email}:`, pushErr.message);
          continue;
        }

        // Mark reminderSentAt for this user so we don't double-send
        const nowDate = new Date();

        if (userSetting) {
          // Update existing reminderSettings entry for this user
          await db.collection('events').updateOne(
            { _id: meeting._id, 'reminderSettings.email': { $regex: `^${email}$`, $options: 'i' } },
            { $set: { 'reminderSettings.$.reminderSentAt': nowDate, updatedAt: nowDate } }
          );
        } else {
          // No custom setting existed — push a new entry with reminderSentAt
          await db.collection('events').updateOne(
            { _id: meeting._id },
            {
              $push: {
                reminderSettings: {
                  email,
                  userId: userDoc._id.toString(),
                  minutesBefore: 15,
                  reminderSentAt: nowDate,
                  updatedAt: nowDate,
                },
              },
              $set: { updatedAt: nowDate },
            }
          );
        }
      }
    }

    return NextResponse.json({ success: true, sent: totalSent });
  } catch (error) {
    console.error('[GET /api/meetings/trigger-reminders] Error:', error);
    return NextResponse.json({ error: 'Failed to trigger reminders.' }, { status: 500 });
  }
}
