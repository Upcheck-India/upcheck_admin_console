/**
 * API endpoint for generating calendar preview data for email templates
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb.js';
import RecurringSeries from '../../../../models/RecurringSeries.js';
import Event from '../../../../models/Event.js';
import { generateCalendarPreview } from '../../../../lib/calendar/ics.js';
import { generateRRule, describeRecurrencePattern } from '../../../../lib/calendar/rrule.js';

/**
 * GET /api/calendar/preview
 * Generate calendar preview data for email templates
 */
export async function GET(request) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const seriesId = searchParams.get('seriesId');
    const meetingId = searchParams.get('meetingId');
    const format = searchParams.get('format') || 'json';
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (!seriesId && !meetingId) {
      return NextResponse.json(
        { error: 'Either seriesId or meetingId is required' },
        { status: 400 }
      );
    }
    
    let previewData = {};
    
    if (seriesId) {
      // Generate preview for recurring series
      const series = await RecurringSeries.findById(seriesId);
      if (!series) {
        return NextResponse.json(
          { error: 'Recurring series not found' },
          { status: 404 }
        );
      }
      
      // Get upcoming meetings
      const upcomingMeetings = await Event.find({
        seriesId: seriesId,
        startTime: { $gte: new Date() },
        'recurrenceInstance.isCancelled': { $ne: true }
      })
      .sort({ startTime: 1 })
      .limit(limit)
      .lean();
      
      previewData = {
        type: 'series',
        series: {
          id: series._id,
          title: series.title,
          description: series.description,
          host: series.host,
          provider: series.provider,
          duration: series.duration,
          participants: series.participants,
          recurrencePattern: series.recurrencePattern
        },
        recurrence: {
          rrule: generateRRule(series.recurrencePattern, new Date(series.startTime)),
          description: describeRecurrencePattern(series.recurrencePattern),
          nextOccurrences: upcomingMeetings.length,
          totalMeetings: series.recurrencePattern.endCondition.type === 'count' ? 
            series.recurrencePattern.endCondition.occurrenceCount : null
        },
        upcomingMeetings: upcomingMeetings.map((meeting, index) => ({
          id: meeting._id,
          startTime: meeting.startTime,
          formattedDate: new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }).format(new Date(meeting.startTime)),
          formattedTime: new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
          }).format(new Date(meeting.startTime)),
          formattedDateTime: new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
          }).format(new Date(meeting.startTime)),
          isNext: index === 0,
          sequenceNumber: index + 1
        })),
        timeline: generateTimelineData(upcomingMeetings.slice(0, 8)),
        statistics: {
          totalParticipants: series.participants.length,
          upcomingMeetings: upcomingMeetings.length,
          nextMeetingDate: upcomingMeetings.length > 0 ? upcomingMeetings[0].startTime : null,
          seriesStartDate: series.createdAt,
          estimatedEndDate: calculateEstimatedEndDate(series.recurrencePattern, series.startTime)
        }
      };
      
    } else if (meetingId) {
      // Generate preview for single meeting
      const meeting = await Event.findById(meetingId);
      if (!meeting) {
        return NextResponse.json(
          { error: 'Meeting not found' },
          { status: 404 }
        );
      }
      
      previewData = {
        type: 'meeting',
        meeting: {
          id: meeting._id,
          title: meeting.effectiveTitle,
          description: meeting.effectiveDescription,
          host: meeting.host,
          provider: meeting.provider,
          duration: meeting.effectiveDuration,
          participants: meeting.effectiveParticipants,
          startTime: meeting.startTime,
          joinUrl: meeting.joinUrl,
          seriesId: meeting.seriesId
        },
        formattedDate: new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }).format(new Date(meeting.startTime)),
        formattedTime: new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        }).format(new Date(meeting.startTime)),
        formattedDateTime: new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        }).format(new Date(meeting.startTime)),
        isRecurring: !!meeting.seriesId,
        recurrenceInfo: meeting.seriesId ? await getRecurrenceInfo(meeting.seriesId) : null
      };
    }
    
    // Add calendar integration URLs
    previewData.calendarUrls = {
      ics: seriesId ? 
        `/api/calendar/series/${seriesId}` : 
        `/api/calendar/meeting/${meetingId}`,
      google: generateGoogleCalendarUrl(previewData),
      outlook: generateOutlookCalendarUrl(previewData),
      yahoo: generateYahooCalendarUrl(previewData)
    };
    
    return NextResponse.json(previewData);
    
  } catch (error) {
    console.error('Error generating calendar preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate calendar preview' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendar/preview
 * Generate calendar preview with custom data
 */
export async function POST(request) {
  try {
    const body = await request.json();
    
    const {
      type = 'series', // 'series' or 'meeting'
      seriesData,
      meetingData,
      upcomingMeetings = [],
      format = 'json'
    } = body;
    
    let previewData = {};
    
    if (type === 'series' && seriesData) {
      previewData = {
        type: 'series',
        series: seriesData,
        recurrence: {
          rrule: generateRRule(seriesData.recurrencePattern, new Date(seriesData.startTime)),
          description: describeRecurrencePattern(seriesData.recurrencePattern),
          nextOccurrences: upcomingMeetings.length,
          totalMeetings: seriesData.recurrencePattern.endCondition.type === 'count' ? 
            seriesData.recurrencePattern.endCondition.occurrenceCount : null
        },
        upcomingMeetings: upcomingMeetings.map((meeting, index) => ({
          ...meeting,
          formattedDate: new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }).format(new Date(meeting.startTime)),
          formattedTime: new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
          }).format(new Date(meeting.startTime)),
          isNext: index === 0,
          sequenceNumber: index + 1
        })),
        timeline: generateTimelineData(upcomingMeetings.slice(0, 8))
      };
      
    } else if (type === 'meeting' && meetingData) {
      previewData = {
        type: 'meeting',
        meeting: meetingData,
        formattedDate: new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }).format(new Date(meetingData.startTime)),
        formattedTime: new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        }).format(new Date(meetingData.startTime)),
        isRecurring: !!meetingData.seriesId
      };
    }
    
    return NextResponse.json(previewData);
    
  } catch (error) {
    console.error('Error generating custom calendar preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate calendar preview' },
      { status: 500 }
    );
  }
}

/**
 * Generate timeline data for visualization
 */
function generateTimelineData(meetings) {
  return meetings.map((meeting, index) => {
    const date = new Date(meeting.startTime);
    const now = new Date();
    const daysDiff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    
    return {
      id: meeting._id,
      date: meeting.startTime,
      dayOfMonth: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      time: date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: 'numeric', 
        hour12: true 
      }),
      daysFromNow: daysDiff,
      isNext: index === 0,
      isPast: date < now,
      status: date < now ? 'past' : (index === 0 ? 'next' : 'upcoming')
    };
  });
}

/**
 * Calculate estimated end date for recurring series
 */
function calculateEstimatedEndDate(recurrencePattern, startTime) {
  if (recurrencePattern.endCondition.type === 'date') {
    return recurrencePattern.endCondition.endDate;
  }
  
  if (recurrencePattern.endCondition.type === 'count') {
    const start = new Date(startTime);
    const count = recurrencePattern.endCondition.occurrenceCount;
    const interval = recurrencePattern.interval || 1;
    
    let estimatedEnd = new Date(start);
    
    switch (recurrencePattern.type) {
      case 'daily':
        estimatedEnd.setDate(estimatedEnd.getDate() + (count * interval));
        break;
      case 'weekly':
        estimatedEnd.setDate(estimatedEnd.getDate() + (count * interval * 7));
        break;
      case 'monthly':
        estimatedEnd.setMonth(estimatedEnd.getMonth() + (count * interval));
        break;
      case 'yearly':
        estimatedEnd.setFullYear(estimatedEnd.getFullYear() + (count * interval));
        break;
    }
    
    return estimatedEnd;
  }
  
  return null; // No end date
}

/**
 * Get recurrence information for a meeting
 */
async function getRecurrenceInfo(seriesId) {
  try {
    const series = await RecurringSeries.findById(seriesId);
    if (!series) return null;
    
    return {
      description: describeRecurrencePattern(series.recurrencePattern),
      rrule: generateRRule(series.recurrencePattern, new Date(series.startTime)),
      totalMeetings: series.recurrencePattern.endCondition.type === 'count' ? 
        series.recurrencePattern.endCondition.occurrenceCount : null
    };
  } catch (error) {
    console.error('Error getting recurrence info:', error);
    return null;
  }
}

/**
 * Generate Google Calendar URL
 */
function generateGoogleCalendarUrl(previewData) {
  if (previewData.type === 'meeting') {
    const meeting = previewData.meeting;
    const startDate = new Date(meeting.startTime);
    const endDate = new Date(startDate.getTime() + (meeting.duration * 60000));
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: meeting.title,
      dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
      details: meeting.description || '',
      location: meeting.provider === 'zoom' ? 'Zoom Meeting' : 'Google Meet'
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }
  
  return null; // Google Calendar doesn't support RRULE in URL parameters
}

/**
 * Generate Outlook Calendar URL
 */
function generateOutlookCalendarUrl(previewData) {
  if (previewData.type === 'meeting') {
    const meeting = previewData.meeting;
    const startDate = new Date(meeting.startTime);
    const endDate = new Date(startDate.getTime() + (meeting.duration * 60000));
    
    const params = new URLSearchParams({
      subject: meeting.title,
      startdt: startDate.toISOString(),
      enddt: endDate.toISOString(),
      body: meeting.description || '',
      location: meeting.provider === 'zoom' ? 'Zoom Meeting' : 'Google Meet'
    });
    
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }
  
  return null;
}

/**
 * Generate Yahoo Calendar URL
 */
function generateYahooCalendarUrl(previewData) {
  if (previewData.type === 'meeting') {
    const meeting = previewData.meeting;
    const startDate = new Date(meeting.startTime);
    const duration = Math.floor(meeting.duration / 60) * 100 + (meeting.duration % 60); // HHMM format
    
    const params = new URLSearchParams({
      v: '60',
      title: meeting.title,
      st: formatYahooDate(startDate),
      dur: duration.toString().padStart(4, '0'),
      desc: meeting.description || '',
      in_loc: meeting.provider === 'zoom' ? 'Zoom Meeting' : 'Google Meet'
    });
    
    return `https://calendar.yahoo.com/?${params.toString()}`;
  }
  
  return null;
}

/**
 * Format date for Google Calendar
 */
function formatGoogleDate(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Format date for Yahoo Calendar
 */
function formatYahooDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}00`;
}