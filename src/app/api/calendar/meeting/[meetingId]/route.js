/**
 * API endpoint for generating calendar files for individual meeting instances
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../lib/mongodb.js';
import Event from '../../../../../models/Event.js';
import { generateInstanceICS, generateCancellationICS, generateUpdateICS } from '../../../../../lib/calendar/ics.js';
import { testICSCompatibility } from '../../../../../lib/calendar/ics.js';

/**
 * GET /api/calendar/meeting/[meetingId]
 * Generate and download ICS file for a single meeting instance
 */
export async function GET(request, { params }) {
  try {
    await connectToDatabase();
    
    const { meetingId } = params;
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const format = searchParams.get('format') || 'ics';
    const timezone = searchParams.get('timezone') || 'UTC';
    const includeAlarms = searchParams.get('alarms') !== 'false';
    const method = searchParams.get('method') || 'REQUEST';
    const token = searchParams.get('token'); // For tracking
    const test = searchParams.get('test') === 'true'; // For compatibility testing
    
    // Find the meeting
    const meeting = await Event.findById(meetingId);
    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }
    
    // Generate appropriate ICS content based on method
    let icsContent;
    let filename;
    
    switch (method.toUpperCase()) {
      case 'CANCEL':
        icsContent = generateCancellationICS(meeting, {
          timezone,
          sequence: 1,
          cancelMessage: 'This meeting has been cancelled.'
        });
        filename = `${meeting.effectiveTitle.replace(/[^a-zA-Z0-9]/g, '_')}_cancelled.ics`;
        break;
        
      case 'REQUEST':
      default:
        icsContent = generateInstanceICS(meeting, {
          timezone,
          includeAlarms,
          method: method.toUpperCase(),
          sequence: 0
        });
        filename = `${meeting.effectiveTitle.replace(/[^a-zA-Z0-9]/g, '_')}_meeting.ics`;
        break;
    }
    
    // If testing mode, return compatibility information
    if (test) {
      const compatibility = testICSCompatibility(icsContent);
      return NextResponse.json({
        compatibility,
        icsContent: icsContent.substring(0, 500) + '...' // Truncated for testing
      });
    }
    
    // Track calendar download if token provided
    if (token) {
      // TODO: Implement tracking logic
      console.log(`Calendar downloaded for meeting ${meetingId} with token ${token}`);
    }
    
    // Return ICS file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Error generating meeting calendar file:', error);
    return NextResponse.json(
      { error: 'Failed to generate calendar file' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendar/meeting/[meetingId]
 * Generate calendar file with custom options or send updates
 */
export async function POST(request, { params }) {
  try {
    await connectToDatabase();
    
    const { meetingId } = params;
    const body = await request.json();
    
    const {
      action = 'generate', // 'generate', 'update', 'cancel'
      timezone = 'UTC',
      includeAlarms = true,
      method = 'REQUEST',
      sequence = 0,
      customMessage = '',
      customAlarms = [],
      includeDescription = true,
      includeLocation = true,
      includeAttendees = true
    } = body;
    
    // Find the meeting
    const meeting = await Event.findById(meetingId);
    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }
    
    let icsContent;
    let filename;
    let responseMethod;
    
    switch (action) {
      case 'cancel':
        icsContent = generateCancellationICS(meeting, {
          timezone,
          sequence: sequence + 1,
          cancelMessage: customMessage || 'This meeting has been cancelled.'
        });
        filename = `${meeting.effectiveTitle.replace(/[^a-zA-Z0-9]/g, '_')}_cancelled.ics`;
        responseMethod = 'CANCEL';
        break;
        
      case 'update':
        icsContent = generateUpdateICS(meeting, {
          timezone,
          includeAlarms,
          sequence: sequence + 1,
          updateMessage: customMessage || 'This meeting has been updated.'
        });
        filename = `${meeting.effectiveTitle.replace(/[^a-zA-Z0-9]/g, '_')}_updated.ics`;
        responseMethod = 'REQUEST';
        break;
        
      case 'generate':
      default:
        // Modify meeting data based on options
        const modifiedMeeting = { ...meeting.toObject() };
        
        if (!includeDescription) {
          modifiedMeeting.effectiveDescription = '';
        }
        
        if (!includeAttendees) {
          modifiedMeeting.effectiveParticipants = [];
        }
        
        icsContent = generateInstanceICS(modifiedMeeting, {
          timezone,
          includeAlarms,
          method: method.toUpperCase(),
          sequence
        });
        filename = `${meeting.effectiveTitle.replace(/[^a-zA-Z0-9]/g, '_')}_meeting.ics`;
        responseMethod = method.toUpperCase();
        break;
    }
    
    // Return ICS content in response
    return NextResponse.json({
      success: true,
      action,
      method: responseMethod,
      icsContent,
      filename,
      size: icsContent.length,
      compatibility: testICSCompatibility(icsContent)
    });
    
  } catch (error) {
    console.error('Error processing meeting calendar request:', error);
    return NextResponse.json(
      { error: 'Failed to process calendar request' },
      { status: 500 }
    );
  }
}