/**
 * API endpoint for email template preview and testing
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb.js';
import RecurringSeries from '../../../../models/RecurringSeries.js';
import Event from '../../../../models/Event.js';
import { renderTemplate } from '../../../../lib/email/templates/seriesNotification.js';
import { renderReminderTemplate } from '../../../../lib/email/templates/reminderNotification.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'series';
    const seriesId = searchParams.get('seriesId');
    const meetingId = searchParams.get('meetingId');

    let previewData;

    if (type === 'series') {
      if (seriesId) {
        // Preview with real series data
        const { db } = await connectToDatabase();
        const series = await db.collection('recurring_series').findOne({ _id: seriesId });
        
        if (!series) {
          return NextResponse.json({
            success: false,
            error: 'Series not found'
          }, { status: 404 });
        }

        previewData = await generateSeriesPreviewData(series);
      } else {
        // Preview with sample data
        previewData = generateSampleSeriesData();
      }

      const rendered = await renderTemplate(previewData);
      
      return NextResponse.json({
        success: true,
        preview: {
          html: rendered.html,
          text: rendered.text,
          subject: rendered.subject,
          data: previewData
        }
      });

    } else if (type === 'reminder') {
      if (meetingId) {
        // Preview with real meeting data
        const { db } = await connectToDatabase();
        const meeting = await db.collection('events').findOne({ _id: meetingId });
        
        if (!meeting) {
          return NextResponse.json({
            success: false,
            error: 'Meeting not found'
          }, { status: 404 });
        }

        previewData = await generateReminderPreviewData(meeting);
      } else {
        // Preview with sample data
        previewData = generateSampleReminderData();
      }

      const rendered = await renderReminderTemplate(previewData);
      
      return NextResponse.json({
        success: true,
        preview: {
          html: rendered.html,
          text: rendered.text,
          subject: rendered.subject,
          data: previewData
        }
      });

    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid preview type. Use "series" or "reminder"'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Email preview error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate email preview'
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, customData } = body;

    if (!type) {
      return NextResponse.json({
        success: false,
        error: 'Email type is required'
      }, { status: 400 });
    }

    let rendered;

    if (type === 'series') {
      const data = customData || generateSampleSeriesData();
      rendered = await renderTemplate(data);
    } else if (type === 'reminder') {
      const data = customData || generateSampleReminderData();
      rendered = await renderReminderTemplate(data);
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid email type. Use "series" or "reminder"'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      preview: {
        html: rendered.html,
        text: rendered.text,
        subject: rendered.subject,
        data: customData
      }
    });

  } catch (error) {
    console.error('Custom email preview error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate custom email preview'
    }, { status: 500 });
  }
}

async function generateSeriesPreviewData(series) {
  const { db } = await connectToDatabase();
  
  // Get upcoming meetings for this series
  const upcomingMeetings = await db.collection('events')
    .find({ 
      seriesId: series._id,
      startTime: { $gte: new Date() }
    })
    .sort({ startTime: 1 })
    .limit(5)
    .toArray();

  return {
    meetingTitle: series.title,
    hostName: series.hostName || 'Meeting Host',
    hostEmail: series.host,
    participants: series.participants || [],
    recurrencePattern: series.recurrencePattern,
    upcomingMeetings: upcomingMeetings.map(m => m.startTime),
    totalMeetings: series.totalInstances || 0,
    seriesId: series._id,
    createdAt: series.createdAt,
    trackingToken: `preview-${Date.now()}`
  };
}

async function generateReminderPreviewData(meeting) {
  return {
    meetingTitle: meeting.title,
    hostName: meeting.hostName || 'Meeting Host',
    hostEmail: meeting.host,
    participants: meeting.participants || [],
    startTime: meeting.startTime,
    duration: meeting.duration || 60,
    joinUrl: meeting.joinUrl || meeting.zoomJoinUrl,
    meetingId: meeting._id,
    reminderType: '1h',
    trackingToken: `preview-${Date.now()}`
  };
}

function generateSampleSeriesData() {
  return {
    meetingTitle: 'Weekly Team Standup',
    hostName: 'John Doe',
    hostEmail: 'john.doe@company.com',
    participants: [
      { email: 'alice@company.com', name: 'Alice Smith' },
      { email: 'bob@company.com', name: 'Bob Johnson' },
      { email: 'carol@company.com', name: 'Carol Wilson' }
    ],
    recurrencePattern: {
      type: 'weekly',
      interval: 1,
      daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
      endCondition: { type: 'count', occurrenceCount: 10 }
    },
    upcomingMeetings: [
      new Date('2024-01-15T10:00:00Z'),
      new Date('2024-01-17T10:00:00Z'),
      new Date('2024-01-19T10:00:00Z'),
      new Date('2024-01-22T10:00:00Z'),
      new Date('2024-01-24T10:00:00Z')
    ],
    totalMeetings: 10,
    seriesId: 'sample-series-123',
    createdAt: new Date(),
    trackingToken: 'preview-token-123'
  };
}

function generateSampleReminderData() {
  return {
    meetingTitle: 'Weekly Team Standup',
    hostName: 'John Doe',
    hostEmail: 'john.doe@company.com',
    participants: [
      { email: 'alice@company.com', name: 'Alice Smith' },
      { email: 'bob@company.com', name: 'Bob Johnson' }
    ],
    startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    duration: 60,
    joinUrl: 'https://zoom.us/j/123456789',
    meetingId: 'sample-meeting-123',
    reminderType: '1h',
    trackingToken: 'preview-token-456'
  };
}