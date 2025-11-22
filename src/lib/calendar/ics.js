/**
 * Comprehensive ICS (iCalendar) file generator with RRULE support
 * RFC 5545 compliant calendar file generation
 */

import { generateRRule, generateExDates, generateRDates } from './rrule.js';

/**
 * Generate ICS file for a recurring meeting series
 */
export function generateSeriesICS(series, options = {}) {
  const {
    timezone = 'UTC',
    includeAlarms = true,
    method = 'REQUEST',
    sequence = 0,
    exceptions = [],
    additionalDates = []
  } = options;

  const startDate = new Date(series.startTime || new Date());
  const endDate = new Date(startDate.getTime() + (series.duration * 60000));
  
  // Generate RRULE
  const rrule = generateRRule(series.recurrencePattern, startDate, timezone);
  
  // Generate exception dates
  const exDates = generateExDates(exceptions, timezone);
  
  // Generate additional dates
  const rDates = generateRDates(additionalDates, timezone);
  
  // Create unique UID for the series
  const uid = `recurring-${series._id}@upcheck.meetings`;
  
  let ics = '';
  
  // Calendar header
  ics += 'BEGIN:VCALENDAR\r\n';
  ics += 'VERSION:2.0\r\n';
  ics += 'PRODID:-//Upcheck Meetings//Recurring Meetings//EN\r\n';
  ics += 'CALSCALE:GREGORIAN\r\n';
  ics += `METHOD:${method}\r\n`;
  
  // Timezone information (if not UTC)
  if (timezone !== 'UTC') {
    ics += generateTimezoneComponent(timezone);
  }
  
  // Main event
  ics += 'BEGIN:VEVENT\r\n';
  ics += `UID:${uid}\r\n`;
  ics += `DTSTAMP:${formatDateTimeUTC(new Date())}\r\n`;
  ics += `DTSTART${timezone === 'UTC' ? '' : `;TZID=${timezone}`}:${formatDateTime(startDate, timezone)}\r\n`;
  ics += `DTEND${timezone === 'UTC' ? '' : `;TZID=${timezone}`}:${formatDateTime(endDate, timezone)}\r\n`;
  ics += `SUMMARY:${escapeText(series.title)}\r\n`;
  
  if (series.description) {
    ics += `DESCRIPTION:${escapeText(series.description)}\r\n`;
  }
  
  ics += `LOCATION:${escapeText(getLocationText(series))}\r\n`;
  ics += `ORGANIZER;CN=${escapeText(series.host)}:MAILTO:${series.host}\r\n`;
  
  // Add attendees
  if (series.participants && series.participants.length > 0) {
    for (const participant of series.participants) {
      ics += `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:MAILTO:${participant}\r\n`;
    }
  }
  
  ics += `STATUS:CONFIRMED\r\n`;
  ics += `SEQUENCE:${sequence}\r\n`;
  ics += `TRANSP:OPAQUE\r\n`;
  
  // Add recurrence rule
  ics += `${rrule}\r\n`;
  
  // Add exception dates if any
  if (exDates) {
    ics += `${exDates}\r\n`;
  }
  
  // Add additional dates if any
  if (rDates) {
    ics += `${rDates}\r\n`;
  }
  
  // Add alarms/reminders
  if (includeAlarms && series.reminderSettings) {
    for (const reminder of series.reminderSettings) {
      if (reminder.enabled) {
        ics += generateAlarmComponent(reminder.timing);
      }
    }
  }
  
  // Add URL if available
  if (series.joinUrl) {
    ics += `URL:${series.joinUrl}\r\n`;
  }
  
  // Add categories
  ics += `CATEGORIES:Meeting,Recurring\r\n`;
  
  // Add custom properties
  ics += `X-UPCHECK-SERIES-ID:${series._id}\r\n`;
  ics += `X-UPCHECK-PROVIDER:${series.provider}\r\n`;
  
  ics += 'END:VEVENT\r\n';
  ics += 'END:VCALENDAR\r\n';
  
  return ics;
}

/**
 * Generate ICS file for a single meeting instance
 */
export function generateInstanceICS(meeting, options = {}) {
  const {
    timezone = 'UTC',
    includeAlarms = true,
    method = 'REQUEST',
    sequence = 0
  } = options;

  const startDate = new Date(meeting.startTime);
  const endDate = new Date(startDate.getTime() + (meeting.effectiveDuration * 60000));
  
  // Create unique UID for the instance
  const uid = meeting.seriesId ? 
    `instance-${meeting._id}-${meeting.seriesId}@upcheck.meetings` :
    `meeting-${meeting._id}@upcheck.meetings`;
  
  let ics = '';
  
  // Calendar header
  ics += 'BEGIN:VCALENDAR\r\n';
  ics += 'VERSION:2.0\r\n';
  ics += 'PRODID:-//Upcheck Meetings//Meeting Instance//EN\r\n';
  ics += 'CALSCALE:GREGORIAN\r\n';
  ics += `METHOD:${method}\r\n`;
  
  // Timezone information (if not UTC)
  if (timezone !== 'UTC') {
    ics += generateTimezoneComponent(timezone);
  }
  
  // Event
  ics += 'BEGIN:VEVENT\r\n';
  ics += `UID:${uid}\r\n`;
  ics += `DTSTAMP:${formatDateTimeUTC(new Date())}\r\n`;
  ics += `DTSTART${timezone === 'UTC' ? '' : `;TZID=${timezone}`}:${formatDateTime(startDate, timezone)}\r\n`;
  ics += `DTEND${timezone === 'UTC' ? '' : `;TZID=${timezone}`}:${formatDateTime(endDate, timezone)}\r\n`;
  ics += `SUMMARY:${escapeText(meeting.effectiveTitle)}\r\n`;
  
  if (meeting.effectiveDescription) {
    ics += `DESCRIPTION:${escapeText(meeting.effectiveDescription)}\r\n`;
  }
  
  ics += `LOCATION:${escapeText(getLocationText(meeting))}\r\n`;
  ics += `ORGANIZER;CN=${escapeText(meeting.host)}:MAILTO:${meeting.host}\r\n`;
  
  // Add attendees
  if (meeting.effectiveParticipants && meeting.effectiveParticipants.length > 0) {
    for (const participant of meeting.effectiveParticipants) {
      ics += `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:MAILTO:${participant}\r\n`;
    }
  }
  
  ics += `STATUS:CONFIRMED\r\n`;
  ics += `SEQUENCE:${sequence}\r\n`;
  ics += `TRANSP:OPAQUE\r\n`;
  
  // Add recurrence ID if this is part of a series
  if (meeting.seriesId && meeting.recurrenceInstance) {
    const originalDate = new Date(meeting.recurrenceInstance.originalDate);
    ics += `RECURRENCE-ID${timezone === 'UTC' ? '' : `;TZID=${timezone}`}:${formatDateTime(originalDate, timezone)}\r\n`;
  }
  
  // Add alarms/reminders
  if (includeAlarms) {
    // Default reminders: 15 minutes and 1 day before
    ics += generateAlarmComponent(15); // 15 minutes
    ics += generateAlarmComponent(1440); // 1 day
  }
  
  // Add URL if available
  if (meeting.joinUrl) {
    ics += `URL:${meeting.joinUrl}\r\n`;
  }
  
  // Add categories
  const categories = ['Meeting'];
  if (meeting.seriesId) {
    categories.push('Recurring');
  }
  ics += `CATEGORIES:${categories.join(',')}\r\n`;
  
  // Add custom properties
  ics += `X-UPCHECK-MEETING-ID:${meeting._id}\r\n`;
  if (meeting.seriesId) {
    ics += `X-UPCHECK-SERIES-ID:${meeting.seriesId}\r\n`;
  }
  ics += `X-UPCHECK-PROVIDER:${meeting.provider}\r\n`;
  
  ics += 'END:VEVENT\r\n';
  ics += 'END:VCALENDAR\r\n';
  
  return ics;
}

/**
 * Generate cancellation ICS file
 */
export function generateCancellationICS(meeting, options = {}) {
  const {
    timezone = 'UTC',
    sequence = 1,
    cancelMessage = 'This meeting has been cancelled.'
  } = options;

  const ics = generateInstanceICS(meeting, {
    ...options,
    method: 'CANCEL',
    sequence,
    includeAlarms: false
  });
  
  // Replace the description with cancellation message
  return ics.replace(
    /DESCRIPTION:.*\r\n/,
    `DESCRIPTION:${escapeText(cancelMessage)}\r\n`
  ).replace(
    /STATUS:CONFIRMED/,
    'STATUS:CANCELLED'
  );
}

/**
 * Generate update ICS file
 */
export function generateUpdateICS(meeting, options = {}) {
  const {
    timezone = 'UTC',
    sequence = 1,
    updateMessage = 'This meeting has been updated.'
  } = options;

  return generateInstanceICS(meeting, {
    ...options,
    method: 'REQUEST',
    sequence
  });
}

/**
 * Generate timezone component for ICS
 */
function generateTimezoneComponent(timezone) {
  // This is a simplified timezone component
  // In production, you'd want to use a proper timezone database
  let tz = '';
  
  tz += 'BEGIN:VTIMEZONE\r\n';
  tz += `TZID:${timezone}\r\n`;
  
  // Add standard time component (simplified)
  tz += 'BEGIN:STANDARD\r\n';
  tz += 'DTSTART:20071104T020000\r\n';
  tz += 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r\n';
  tz += 'TZNAME:EST\r\n';
  tz += 'TZOFFSETFROM:-0400\r\n';
  tz += 'TZOFFSETTO:-0500\r\n';
  tz += 'END:STANDARD\r\n';
  
  // Add daylight time component (simplified)
  tz += 'BEGIN:DAYLIGHT\r\n';
  tz += 'DTSTART:20070311T020000\r\n';
  tz += 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r\n';
  tz += 'TZNAME:EDT\r\n';
  tz += 'TZOFFSETFROM:-0500\r\n';
  tz += 'TZOFFSETTO:-0400\r\n';
  tz += 'END:DAYLIGHT\r\n';
  
  tz += 'END:VTIMEZONE\r\n';
  
  return tz;
}

/**
 * Generate alarm component for reminders
 */
function generateAlarmComponent(minutesBefore) {
  let alarm = '';
  
  alarm += 'BEGIN:VALARM\r\n';
  alarm += 'ACTION:DISPLAY\r\n';
  alarm += `DESCRIPTION:Meeting reminder - ${minutesBefore} minutes\r\n`;
  alarm += `TRIGGER:-PT${minutesBefore}M\r\n`;
  alarm += 'END:VALARM\r\n';
  
  return alarm;
}

/**
 * Format date/time for ICS (local time)
 */
function formatDateTime(date, timezone = 'UTC') {
  if (timezone === 'UTC') {
    return formatDateTimeUTC(date);
  }
  
  // For local time (without Z suffix)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * Format date/time for ICS (UTC)
 */
function formatDateTimeUTC(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape text for ICS format
 */
function escapeText(text) {
  if (!text) return '';
  
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Get location text for meeting
 */
function getLocationText(meeting) {
  if (meeting.provider === 'zoom') {
    return 'Zoom Meeting';
  } else if (meeting.provider === 'google_meet') {
    return 'Google Meet';
  }
  return 'Online Meeting';
}

/**
 * Validate ICS content
 */
export function validateICS(icsContent) {
  const errors = [];
  const warnings = [];
  
  // Check basic structure
  if (!icsContent.includes('BEGIN:VCALENDAR')) {
    errors.push('Missing BEGIN:VCALENDAR');
  }
  
  if (!icsContent.includes('END:VCALENDAR')) {
    errors.push('Missing END:VCALENDAR');
  }
  
  if (!icsContent.includes('VERSION:2.0')) {
    errors.push('Missing or invalid VERSION');
  }
  
  if (!icsContent.includes('PRODID:')) {
    errors.push('Missing PRODID');
  }
  
  // Check for events
  const eventCount = (icsContent.match(/BEGIN:VEVENT/g) || []).length;
  const eventEndCount = (icsContent.match(/END:VEVENT/g) || []).length;
  
  if (eventCount === 0) {
    warnings.push('No events found in calendar');
  }
  
  if (eventCount !== eventEndCount) {
    errors.push('Mismatched BEGIN:VEVENT and END:VEVENT count');
  }
  
  // Check required event properties
  if (eventCount > 0) {
    if (!icsContent.includes('UID:')) {
      errors.push('Events missing UID property');
    }
    
    if (!icsContent.includes('DTSTAMP:')) {
      errors.push('Events missing DTSTAMP property');
    }
    
    if (!icsContent.includes('DTSTART:')) {
      errors.push('Events missing DTSTART property');
    }
  }
  
  // Check line length (RFC 5545 recommends max 75 characters)
  const lines = icsContent.split('\r\n');
  const longLines = lines.filter(line => line.length > 75);
  if (longLines.length > 0) {
    warnings.push(`${longLines.length} lines exceed recommended 75 character limit`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Test ICS compatibility with major calendar applications
 */
export function testICSCompatibility(icsContent) {
  const validation = validateICS(icsContent);
  
  const compatibility = {
    googleCalendar: true,
    outlookCalendar: true,
    appleCalendar: true,
    thunderbird: true,
    issues: [...validation.errors]
  };
  
  if (!validation.valid) {
    compatibility.googleCalendar = false;
    compatibility.outlookCalendar = false;
    compatibility.appleCalendar = false;
    compatibility.thunderbird = false;
    return compatibility;
  }
  
  // Check for potential compatibility issues
  
  // Very long descriptions can cause issues in some clients
  if (icsContent.includes('DESCRIPTION:') && icsContent.match(/DESCRIPTION:[^\r\n]{500,}/)) {
    compatibility.issues.push('Very long descriptions may be truncated in some calendar applications');
  }
  
  // Complex RRULE patterns
  if (icsContent.includes('RRULE:') && icsContent.includes('BYDAY=') && icsContent.includes('BYSETPOS=')) {
    compatibility.issues.push('Complex recurrence patterns may not display correctly in all calendar applications');
  }
  
  // Multiple alarms
  const alarmCount = (icsContent.match(/BEGIN:VALARM/g) || []).length;
  if (alarmCount > 5) {
    compatibility.issues.push('Multiple alarms (>5) may not be supported by all calendar applications');
  }
  
  // Custom properties
  if (icsContent.includes('X-')) {
    compatibility.issues.push('Custom X- properties may be ignored by some calendar applications');
  }
  
  return compatibility;
}

/**
 * Generate calendar preview data for email templates
 */
export function generateCalendarPreview(series, upcomingMeetings) {
  const preview = {
    seriesTitle: series.title,
    recurrenceDescription: '',
    upcomingMeetings: [],
    totalMeetings: 0,
    nextMeeting: null
  };
  
  // Generate recurrence description
  if (series.recurrencePattern) {
    const rrule = generateRRule(series.recurrencePattern, new Date(series.startTime));
    preview.recurrenceDescription = describeRRule(rrule);
  }
  
  // Process upcoming meetings
  if (upcomingMeetings && upcomingMeetings.length > 0) {
    preview.upcomingMeetings = upcomingMeetings.slice(0, 10).map(meeting => ({
      date: meeting.startTime,
      formattedDate: new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }).format(new Date(meeting.startTime)),
      isNext: false
    }));
    
    // Mark the next meeting
    if (preview.upcomingMeetings.length > 0) {
      preview.upcomingMeetings[0].isNext = true;
      preview.nextMeeting = preview.upcomingMeetings[0];
    }
  }
  
  // Calculate total meetings
  if (series.recurrencePattern.endCondition.type === 'count') {
    preview.totalMeetings = series.recurrencePattern.endCondition.occurrenceCount;
  }
  
  return preview;
}