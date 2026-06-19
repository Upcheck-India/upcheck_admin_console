import Notification from '../models/Notification.js';
import Event from '../models/Event.js';
import RecurringSeries from '../models/RecurringSeries.js';
import { sendEmail } from './email.js';
import { connectToDatabase } from './mongodb.js';
import { scheduleJob } from './scheduler.js';
import { v4 as uuidv4 } from 'uuid';
import { generateSeriesNotificationHtml, generateSeriesNotificationText } from './email/templates/seriesNotification.js';
import { generateReminderNotificationHtml, generateReminderNotificationText } from './email/templates/reminderNotification.js';

/**
 * Notification Scheduler Service
 * Manages automated reminder notifications and series notifications
 */

/**
 * Schedule reminders for a meeting based on reminder settings
 */
export async function scheduleReminders(meetingId, reminderSettings = []) {
  try {
    await connectToDatabase();
    
    const meeting = await Event.findById(meetingId);
    if (!meeting) {
      throw new Error(`Meeting ${meetingId} not found`);
    }

    if (reminderSettings.length === 0) {
      console.log(`No reminder settings for meeting ${meetingId}`);
      return [];
    }

    const scheduledNotifications = [];

    for (const reminderSetting of reminderSettings) {
      if (!reminderSetting.enabled) {
        continue;
      }

      // Calculate when to send the reminder
      const reminderTime = new Date(meeting.startTime.getTime() - reminderSetting.timing * 60000);
      
      // Don't schedule reminders for past times
      if (reminderTime <= new Date()) {
        console.log(`Skipping past reminder for meeting ${meetingId} at ${reminderTime}`);
        continue;
      }

      // Create notifications for each participant
      for (const participantEmail of meeting.effectiveParticipants) {
        const notification = new Notification({
          meetingId: meeting._id,
          seriesId: meeting.seriesId,
          recipient: participantEmail,
          type: 'reminder',
          timing: reminderSetting.timing,
          status: 'scheduled',
          scheduledFor: reminderTime,
          tracking: {
            token: uuidv4(),
            opened: false,
            clicked: false,
            acknowledged: false
          }
        });

        await notification.save();

        // Schedule the job to send the reminder
        await scheduleJob('send_reminder', {
          notificationId: notification._id
        }, reminderTime);

        scheduledNotifications.push(notification);
        
        console.log(`Scheduled reminder for ${participantEmail} at ${reminderTime} (${reminderSetting.timing} minutes before)`);
      }
    }

    console.log(`Scheduled ${scheduledNotifications.length} reminder notifications for meeting ${meetingId}`);
    return scheduledNotifications;

  } catch (error) {
    console.error(`Error scheduling reminders for meeting ${meetingId}:`, error);
    throw error;
  }
}

/**
 * Send a reminder notification
 */
export async function sendReminder(notificationId) {
  try {
    await connectToDatabase();
    
    const notification = await Notification.findById(notificationId)
      .populate('meetingId')
      .populate('seriesId');
    
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    if (notification.status !== 'scheduled') {
      console.log(`Notification ${notificationId} is not scheduled (status: ${notification.status})`);
      return;
    }

    const meeting = notification.meetingId;
    if (!meeting) {
      throw new Error(`Meeting not found for notification ${notificationId}`);
    }

    // Check if meeting is cancelled
    if (meeting.status === 'cancelled' || meeting.recurrenceInstance?.isCancelled) {
      console.log(`Meeting ${meeting._id} is cancelled, skipping reminder`);
      notification.status = 'cancelled';
      await notification.save();
      return;
    }

    // Generate tracking URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const trackingToken = notification.tracking.token;
    
    const openPixelUrl = meeting.trackOpens ? 
      `${baseUrl}/api/tracking/open?token=${trackingToken}` : null;
    
    const trackedJoinUrl = meeting.trackClicks ? 
      `${baseUrl}/api/tracking/click?token=${trackingToken}&redirect=${encodeURIComponent(meeting.joinUrl)}` : 
      meeting.joinUrl;
    
    const ackUrl = meeting.trackAck ? 
      `${baseUrl}/api/tracking/ack?token=${trackingToken}` : null;

    // Determine reminder timing text
    const timingText = getTimingText(notification.timing);
    
    // Create subject line with urgency indicator
    const urgencyPrefix = notification.timing <= 15 ? '🚨 URGENT: ' : 
                         notification.timing <= 60 ? '⏰ ' : 
                         '📅 ';
    const subject = `${urgencyPrefix}Reminder: ${meeting.effectiveTitle} starts ${timingText}`;

    // Check if this is part of a recurring series
    const isSeriesMeeting = !!meeting.seriesId;
    let seriesInfo = null;
    
    if (isSeriesMeeting) {
      try {
        const series = await RecurringSeries.findById(meeting.seriesId);
        if (series) {
          seriesInfo = {
            title: series.title,
            description: getRecurrenceDescription(series.recurrencePattern)
          };
        }
      } catch (error) {
        console.error('Error fetching series info for reminder:', error);
      }
    }

    // Generate enhanced reminder email
    const htmlContent = generateReminderNotificationHtml(meeting, {
      openPixelUrl,
      trackedJoinUrl,
      ackUrl,
      trackingToken,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      recipient: notification.recipient,
      reminderTiming: notification.timing,
      isSeriesMeeting,
      seriesInfo
    });

    const textContent = generateReminderNotificationText(meeting, {
      recipient: notification.recipient,
      reminderTiming: notification.timing,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    });

     // Send enhanced reminder email via centralized email service
     const { sendEmail } = await import('./emailService.js');
     await sendEmail({
       to: notification.recipient,
       subject,
       html: htmlContent,
       text: textContent,
       type: 'meeting_reminder'
     });

    // Update notification status
    notification.status = 'sent';
    notification.sentAt = new Date();
    await notification.save();

    console.log(`Sent reminder to ${notification.recipient} for meeting ${meeting._id}`);

  } catch (error) {
    console.error(`Error sending reminder ${notificationId}:`, error);
    
    // Update notification with error
    try {
      const notification = await Notification.findById(notificationId);
      if (notification) {
        notification.status = 'failed';
        notification.error = {
          message: error.message,
          retryCount: (notification.error?.retryCount || 0) + 1,
          lastFailedAt: new Date()
        };
        await notification.save();
      }
    } catch (updateError) {
      console.error(`Error updating notification status:`, updateError);
    }
    
    throw error;
  }
}

/**
 * Send series notification email when creating recurring meetings
 */
export async function sendSeriesNotification(seriesId, participants = []) {
  try {
    await connectToDatabase();
    
    const series = await RecurringSeries.findById(seriesId);
    if (!series) {
      throw new Error(`Recurring series ${seriesId} not found`);
    }

    if (!series.seriesNotification.enabled) {
      console.log(`Series notification disabled for series ${seriesId}`);
      return [];
    }

    if (series.seriesNotification.sent) {
      console.log(`Series notification already sent for series ${seriesId}`);
      return [];
    }

    // Get upcoming meetings for the series (next 10 occurrences)
    const upcomingMeetings = await Event.find({
      seriesId: seriesId,
      startTime: { $gte: new Date() },
      'recurrenceInstance.isCancelled': { $ne: true }
    })
    .sort({ startTime: 1 })
    .limit(10)
    .lean();

    const sentNotifications = [];

    // Create and send series notifications
    for (const participantEmail of participants) {
      const notification = new Notification({
        seriesId: series._id,
        recipient: participantEmail,
        type: 'series_notification',
        status: 'scheduled',
        scheduledFor: new Date(),
        seriesData: {
          upcomingMeetings: upcomingMeetings.map(m => m.startTime),
          totalMeetings: series.recurrencePattern.endCondition.type === 'count' ? 
            series.recurrencePattern.endCondition.occurrenceCount : null,
          recurrenceDescription: getRecurrenceDescription(series.recurrencePattern)
        },
        tracking: {
          token: uuidv4(),
          opened: false,
          clicked: false,
          acknowledged: false
        }
      });

      await notification.save();

      // Send the series notification email
      await sendSeriesNotificationEmail(notification, series, upcomingMeetings);

      notification.status = 'sent';
      notification.sentAt = new Date();
      await notification.save();

      sentNotifications.push(notification);
      
      console.log(`Sent series notification to ${participantEmail} for series ${seriesId}`);
    }

    // Mark series notification as sent
    series.seriesNotification.sent = true;
    series.seriesNotification.sentAt = new Date();
    await series.save();

    console.log(`Sent ${sentNotifications.length} series notifications for series ${seriesId}`);
    return sentNotifications;

  } catch (error) {
    console.error(`Error sending series notification for series ${seriesId}:`, error);
    throw error;
  }
}

/**
 * Send series notification email using premium template
 */
async function sendSeriesNotificationEmail(notification, series, upcomingMeetings) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const trackingToken = notification.tracking.token;
  
  const openPixelUrl = series.trackOpens ? 
    `${baseUrl}/api/tracking/open?token=${trackingToken}` : null;
  
  const ackUrl = series.trackAck ? 
    `${baseUrl}/api/tracking/ack?token=${trackingToken}` : null;

  const subject = `🔄 New Meeting Series: ${series.title}`;

  // Generate premium HTML and text versions
  const htmlContent = generateSeriesNotificationHtml(series, upcomingMeetings, {
    openPixelUrl,
    ackUrl,
    trackingToken,
    baseUrl,
    recipient: notification.recipient
  });

  const textContent = generateSeriesNotificationText(series, upcomingMeetings, {
    baseUrl,
    recipient: notification.recipient
  });

  // Send email using premium template via centralized email service
  const { sendEmail } = await import('./emailService.js');
  await sendEmail({
    to: notification.recipient,
    subject,
    html: htmlContent,
    text: textContent,
    type: 'meeting_invite'
  });
}



/**
 * Get human-readable timing text for reminders
 */
function getTimingText(minutes) {
  if (minutes < 60) {
    return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (minutes < 1440) { // Less than 24 hours
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return `in ${hours}h ${remainingMinutes}m`;
    }
  } else { // 24 hours or more
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    if (remainingHours === 0) {
      return `in ${days} day${days !== 1 ? 's' : ''}`;
    } else {
      return `in ${days}d ${remainingHours}h`;
    }
  }
}

/**
 * Get human-readable recurrence description
 */
function getRecurrenceDescription(pattern) {
  const { type, interval, daysOfWeek, dayOfMonth, endCondition } = pattern;
  
  let description = '';
  
  switch (type) {
    case 'daily':
      description = interval === 1 ? 'Daily' : `Every ${interval} days`;
      break;
    
    case 'weekly':
      if (interval === 1) {
        if (daysOfWeek && daysOfWeek.length > 0) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const selectedDays = daysOfWeek.map(d => dayNames[d]).join(', ');
          description = `Weekly on ${selectedDays}`;
        } else {
          description = 'Weekly';
        }
      } else {
        description = `Every ${interval} weeks`;
      }
      break;
    
    case 'monthly':
      if (dayOfMonth) {
        description = interval === 1 ? 
          `Monthly on the ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)}` : 
          `Every ${interval} months on the ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)}`;
      } else {
        description = interval === 1 ? 'Monthly' : `Every ${interval} months`;
      }
      break;
    
    case 'custom':
      description = `Every ${interval} ${interval === 1 ? 'occurrence' : 'occurrences'}`;
      break;
    
    default:
      description = 'Custom schedule';
  }
  
  // Add end condition
  if (endCondition.type === 'date') {
    const endDate = new Date(endCondition.endDate);
    description += ` until ${endDate.toLocaleDateString()}`;
  } else if (endCondition.type === 'count') {
    description += ` for ${endCondition.occurrenceCount} meetings`;
  }
  
  return description;
}

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

/**
 * Handle notification failures and retries
 */
export async function handleNotificationFailure(notificationId, error) {
  try {
    await connectToDatabase();
    
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      console.error(`Notification ${notificationId} not found for failure handling`);
      return;
    }

    const retryCount = (notification.error?.retryCount || 0) + 1;
    const maxRetries = 3;

    notification.error = {
      message: error.message,
      retryCount,
      lastFailedAt: new Date()
    };

    if (retryCount < maxRetries) {
      // Schedule retry with exponential backoff
      const delayMs = Math.min(1000 * Math.pow(2, retryCount), 300000); // Max 5 minutes
      const retryTime = new Date(Date.now() + delayMs);
      
      notification.status = 'scheduled';
      notification.scheduledFor = retryTime;
      await notification.save();

      // Schedule retry job
      await scheduleJob('send_reminder', {
        notificationId: notification._id
      }, retryTime);

      console.log(`Scheduled retry ${retryCount}/${maxRetries} for notification ${notificationId} in ${delayMs}ms`);
    } else {
      notification.status = 'failed';
      await notification.save();
      
      console.error(`Notification ${notificationId} failed permanently after ${maxRetries} attempts`);
    }

  } catch (updateError) {
    console.error(`Error handling notification failure for ${notificationId}:`, updateError);
  }
}

/**
 * Get notifications that need to be sent
 */
export async function getNotificationsToSend() {
  try {
    await connectToDatabase();
    
    const now = new Date();
    
    const notifications = await Notification.find({
      status: 'scheduled',
      scheduledFor: { $lte: now }
    })
    .populate('meetingId')
    .populate('seriesId')
    .sort({ scheduledFor: 1 })
    .limit(50); // Process in batches

    console.log(`Found ${notifications.length} notifications ready to send`);
    return notifications;

  } catch (error) {
    console.error('Error getting notifications to send:', error);
    throw error;
  }
}

/**
 * Cancel notifications for a meeting or series
 */
export async function cancelNotifications(meetingId = null, seriesId = null) {
  try {
    await connectToDatabase();
    
    const query = { status: { $in: ['scheduled', 'pending'] } };
    
    if (meetingId) {
      query.meetingId = meetingId;
    }
    if (seriesId) {
      query.seriesId = seriesId;
    }

    const result = await Notification.updateMany(query, {
      status: 'cancelled',
      updatedAt: new Date()
    });

    console.log(`Cancelled ${result.modifiedCount} notifications`);
    return result.modifiedCount;

  } catch (error) {
    console.error('Error cancelling notifications:', error);
    throw error;
  }
}