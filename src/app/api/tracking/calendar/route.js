/**
 * API endpoint for tracking calendar additions
 */

import { NextResponse } from 'next/server';
import EmailAnalytics from '../../../../lib/analytics/emailTracking.js';

/**
 * GET /api/tracking/calendar
 * Track calendar addition events
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const type = searchParams.get('type') || 'ics';
    const redirect = searchParams.get('redirect');
    
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // Get user agent and IP from headers
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // Track the calendar addition event
    await EmailAnalytics.trackCalendarAdd(token, type, userAgent, ipAddress);

    // If redirect URL is provided, redirect there
    if (redirect) {
      return NextResponse.redirect(redirect, { status: 302 });
    }

    // Otherwise return success response
    return NextResponse.json({ 
      success: true, 
      message: 'Calendar addition tracked successfully' 
    });

  } catch (error) {
    console.error('Error tracking calendar addition:', error);
    
    // Still redirect if URL is provided
    const redirect = new URL(request.url).searchParams.get('redirect');
    if (redirect) {
      return NextResponse.redirect(redirect, { status: 302 });
    }
    
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}

/**
 * POST /api/tracking/calendar
 * Track calendar addition with additional metadata
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { token, calendarType, calendarApp, success } = body;
    
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // Get user agent and IP from headers
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // Track the calendar addition
    if (success !== false) {
      await EmailAnalytics.trackCalendarAdd(token, calendarType, userAgent, ipAddress);
    }

    // Record additional metadata
    await EmailAnalytics.recordAnalyticsEvent({
      type: 'calendar_interaction',
      token,
      timestamp: new Date(),
      metadata: {
        calendarType,
        calendarApp,
        success,
        userAgent,
        ipAddress
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Calendar interaction tracked successfully' 
    });

  } catch (error) {
    console.error('Error tracking calendar interaction:', error);
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}