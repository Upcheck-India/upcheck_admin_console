/**
 * API endpoint for tracking email acknowledgments
 */

import { NextResponse } from 'next/server';
import EmailAnalytics from '../../../../lib/analytics/emailTracking.js';

/**
 * GET /api/tracking/ack
 * Track email acknowledgment events
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // Get user agent and IP from headers
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // Track the acknowledgment event
    const success = await EmailAnalytics.trackAcknowledgment(token, userAgent, ipAddress);

    if (success) {
      // Return a success page
      const successHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Thank You - Upcheck Meetings</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .container {
              background: white;
              border-radius: 24px;
              padding: 48px 32px;
              text-align: center;
              max-width: 500px;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            }
            .icon {
              font-size: 64px;
              margin-bottom: 24px;
              animation: bounce 2s infinite;
            }
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-10px); }
            }
            h1 {
              font-size: 32px;
              font-weight: 800;
              color: #111827;
              margin-bottom: 16px;
            }
            p {
              font-size: 18px;
              color: #4B5563;
              line-height: 1.6;
              margin-bottom: 32px;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              padding: 16px 32px;
              border-radius: 12px;
              font-weight: 700;
              font-size: 16px;
              transition: transform 0.3s ease;
            }
            .button:hover {
              transform: translateY(-2px);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✅</div>
            <h1>Thank You!</h1>
            <p>
              Your acknowledgment has been recorded successfully. 
              We appreciate you taking the time to confirm receipt of your meeting notification.
            </p>
            <a href="#" class="button" onclick="window.close()">Close Window</a>
          </div>
        </body>
        </html>
      `;

      return new NextResponse(successHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        }
      });
    } else {
      return NextResponse.json({ error: 'Failed to record acknowledgment' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error tracking email acknowledgment:', error);
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}

/**
 * POST /api/tracking/ack
 * Track acknowledgment with additional data
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { token, feedback, rating } = body;
    
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // Get user agent and IP from headers
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // Track the acknowledgment with additional data
    const success = await EmailAnalytics.trackAcknowledgment(token, userAgent, ipAddress);

    if (success) {
      // Store additional feedback if provided
      if (feedback || rating) {
        await EmailAnalytics.recordAnalyticsEvent({
          type: 'acknowledgment_feedback',
          token,
          timestamp: new Date(),
          metadata: {
            feedback,
            rating,
            userAgent,
            ipAddress
          }
        });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Acknowledgment recorded successfully' 
      });
    } else {
      return NextResponse.json({ error: 'Failed to record acknowledgment' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error tracking email acknowledgment:', error);
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}