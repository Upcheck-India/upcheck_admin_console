/**
 * API endpoint for tracking email clicks
 */

import { NextResponse } from 'next/server';
import EmailAnalytics from '../../../../lib/analytics/emailTracking.js';

/**
 * GET /api/tracking/click
 * Track email click events and redirect to target URL
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const redirect = searchParams.get('redirect');
    
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    if (!redirect) {
      return NextResponse.json({ error: 'Missing redirect URL' }, { status: 400 });
    }

    // Get user agent and IP from headers
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // Track the click event
    await EmailAnalytics.trackClick(token, redirect, userAgent, ipAddress);

    // Redirect to the target URL
    return NextResponse.redirect(redirect, { status: 302 });

  } catch (error) {
    console.error('Error tracking email click:', error);
    
    // Still redirect even if tracking fails
    const redirect = new URL(request.url).searchParams.get('redirect');
    if (redirect) {
      return NextResponse.redirect(redirect, { status: 302 });
    }
    
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}