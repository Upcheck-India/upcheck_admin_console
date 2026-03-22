/**
 * API endpoint for generating calendar files for recurring meeting series
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../lib/mongodb.js';
import RecurringSeries from '../../../../../models/RecurringSeries.js';
import Event from '../../../../../models/Event.js';
import { generateSeriesICS } from '../../../../../lib/calendar/ics.js';
import { testICSCompatibility } from '../../../../../lib/calendar/ics.js';

/**
 * GET /api/calendar/series/[seriesId]
 * Generate and download ICS file for a recurring meeting series
 */
export async function GET(request, { params }) {
  try {
    await connectToDatabase();
    
    const { seriesId } = params;
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const format = searchParams.get('format') || 'ics';
    const timezone = searchParams.get('timezone') || 'UTC';
    const includeAlarms = searchParams.get('alarms') !== 'false';
    const method = searchParams.get('method') || 'REQUEST';
    const token = searchParams.get('token'); // For tracking
    const test = searchParams.get('test') === 'true'; // For compatibility testing
    
    // Find the recurring series
    const series = await RecurringSeries.findById(seriesId);
    if (!series) {
      return NextResponse.json(
        { error: 'Recurring series not found' },
        { status: 404 }
      );
    }
    
    // Get exceptions (cancelled or modified instances)
    const exceptions = await Event.find({
      seriesId: seriesId,
      $or: [
        { 'recurrenceInstance.isCancelled': true },
        { 'recurrenceInstance.wasModified': true }
      ]
    }).lean();
    
    const exceptionDates = exceptions.map(event => ({
      type: event.recurrenceInstance.isCancelled ? 'cancelled' : 'modified',
      originalDate: event.recurrenceInstance.originalDate
    }));
    
    // Generate ICS content
    const icsContent = generateSeriesICS(series, {
      timezone,
      includeAlarms,
      method,
      exceptions: exceptionDates
    });
    
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
      console.log(`Calendar downloaded for series ${seriesId} with token ${token}`);
    }
    
    // Return ICS file
    const filename = `${series.title.replace(/[^a-zA-Z0-9]/g, '_')}_series.ics`;
    
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
    console.error('Error generating series calendar file:', error);
    return NextResponse.json(
      { error: 'Failed to generate calendar file' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendar/series/[seriesId]
 * Generate calendar file with custom options
 */
export async function POST(request, { params }) {
  try {
    await connectToDatabase();
    
    const { seriesId } = params;
    const body = await request.json();
    
    const {
      timezone = 'UTC',
      includeAlarms = true,
      method = 'REQUEST',
      customAlarms = [],
      includeDescription = true,
      includeLocation = true,
      includeAttendees = true
    } = body;
    
    // Find the recurring series
    const series = await RecurringSeries.findById(seriesId);
    if (!series) {
      return NextResponse.json(
        { error: 'Recurring series not found' },
        { status: 404 }
      );
    }
    
    // Get exceptions
    const exceptions = await Event.find({
      seriesId: seriesId,
      $or: [
        { 'recurrenceInstance.isCancelled': true },
        { 'recurrenceInstance.wasModified': true }
      ]
    }).lean();
    
    const exceptionDates = exceptions.map(event => ({
      type: event.recurrenceInstance.isCancelled ? 'cancelled' : 'modified',
      originalDate: event.recurrenceInstance.originalDate
    }));
    
    // Modify series data based on options
    const modifiedSeries = { ...series.toObject() };
    
    if (!includeDescription) {
      delete modifiedSeries.description;
    }
    
    if (!includeAttendees) {
      modifiedSeries.participants = [];
    }
    
    // Use custom alarms if provided
    if (customAlarms.length > 0) {
      modifiedSeries.reminderSettings = customAlarms.map(minutes => ({
        timing: minutes,
        enabled: true
      }));
    }
    
    // Generate ICS content
    const icsContent = generateSeriesICS(modifiedSeries, {
      timezone,
      includeAlarms,
      method,
      exceptions: exceptionDates
    });
    
    // Return ICS content in response
    return NextResponse.json({
      success: true,
      icsContent,
      filename: `${series.title.replace(/[^a-zA-Z0-9]/g, '_')}_series.ics`,
      size: icsContent.length,
      compatibility: testICSCompatibility(icsContent)
    });
    
  } catch (error) {
    console.error('Error generating custom series calendar file:', error);
    return NextResponse.json(
      { error: 'Failed to generate calendar file' },
      { status: 500 }
    );
  }
}